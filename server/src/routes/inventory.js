import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notify } from '../services/notify.js';
import { availability, needsStock } from '../services/stock.js';

const router = Router();
router.use(requireAuth);
const warehouse = requireRole('WAREHOUSE');

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
const cleanSerial = (s) => String(s ?? '').trim().toUpperCase();
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

// GET /api/inventory/products → stock list (free, reserved, low-stock flag)
router.get('/products', warehouse, async (req, res) => {
  const products = await prisma.product.findMany({
    where: { category: { not: 'SERVICE' } },
    orderBy: [{ category: 'asc' }, { name: 'asc' }],
  });
  const free = await availability(prisma, products);
  const reserved = await prisma.serialUnit.groupBy({
    by: ['productId'],
    where: { status: 'IN_STOCK', orderId: { not: null } },
    _count: { _all: true },
  });
  const reservedBy = Object.fromEntries(reserved.map((r) => [r.productId, r._count._all]));

  res.json(
    products.map((p) => ({
      id: p.id,
      sku: p.sku,
      name: p.name,
      category: p.category,
      isSerialized: p.isSerialized,
      warrantyMonths: p.warrantyMonths,
      reorderLevel: p.reorderLevel,
      available: free[p.id],
      reserved: reservedBy[p.id] || 0,
      low: free[p.id] <= p.reorderLevel,
    })),
  );
});

// POST /api/inventory/products/:id/receive  → { qty } for loose parts, { serials: [...] } for serialised
router.post('/products/:id/receive', warehouse, async (req, res) => {
  const product = await prisma.product.findUnique({ where: { id: readId(req.params.id) ?? 0 } });
  if (!product || !needsStock(product)) return res.status(404).json({ error: 'Product not found' });
  const body = req.body ?? {};

  if (product.isSerialized) {
    const serials = [...new Set((Array.isArray(body.serials) ? body.serials : []).map(cleanSerial).filter(Boolean))];
    if (serials.length === 0) return res.status(400).json({ error: 'Enter at least one serial number' });
    const existing = await prisma.serialUnit.findMany({ where: { serialNo: { in: serials } }, select: { serialNo: true } });
    if (existing.length > 0) {
      return res.status(400).json({ error: `Already in the system: ${existing.map((e) => e.serialNo).join(', ')}` });
    }
    await prisma.serialUnit.createMany({ data: serials.map((serialNo) => ({ serialNo, productId: product.id })) });
    return res.json({ added: serials.length });
  }

  const qty = Number(body.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 100000) return res.status(400).json({ error: 'Enter a quantity' });
  await prisma.product.update({ where: { id: product.id }, data: { stockQty: { increment: qty } } });
  res.json({ added: qty });
});

// GET /api/inventory/deliveries?status=PENDING|DISPATCHED
router.get('/deliveries', warehouse, async (req, res) => {
  const status = req.query.status === 'DISPATCHED' ? 'DISPATCHED' : 'PENDING';
  const deliveries = await prisma.delivery.findMany({
    where: { status },
    orderBy: { id: status === 'PENDING' ? 'asc' : 'desc' },
    take: 100,
    include: {
      dispatchedBy: { select: { name: true } },
      order: {
        select: {
          id: true,
          installAddress: true,
          confirmedAt: true,
          customer: { select: { name: true, phone: true } },
          kit: { select: { name: true } },
        },
      },
    },
  });
  res.json(deliveries);
});

// GET /api/inventory/deliveries/:id → order lines + the serial units that may be scanned
router.get('/deliveries/:id', warehouse, async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid delivery id' });

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      dispatchedBy: { select: { name: true } },
      order: {
        include: {
          customer: true,
          kit: { select: { name: true } },
          lines: { orderBy: { id: 'asc' }, include: { product: true } },
        },
      },
    },
  });
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });

  const serialisedIds = delivery.order.lines.filter((l) => l.product.isSerialized).map((l) => l.productId);
  // Pending: free units + units reserved for this order. Dispatched: the units that were sent.
  const units = await prisma.serialUnit.findMany({
    where:
      delivery.status === 'PENDING'
        ? { productId: { in: serialisedIds }, status: 'IN_STOCK', OR: [{ orderId: null }, { orderId: delivery.orderId }] }
        : { orderId: delivery.orderId, status: { not: 'IN_STOCK' } },
    orderBy: { serialNo: 'asc' },
    select: { serialNo: true, productId: true, orderId: true, status: true, warrantyEnd: true },
  });

  res.json({ ...delivery, units });
});

// POST /api/inventory/deliveries/:id/dispatch  { serials: ["PNL-0001", ...] }
router.post('/deliveries/:id/dispatch', warehouse, async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid delivery id' });

  const scanned = (Array.isArray(req.body?.serials) ? req.body.serials : []).map(cleanSerial).filter(Boolean);
  if (new Set(scanned).size !== scanned.length) return res.status(400).json({ error: 'The same serial was scanned twice' });

  const delivery = await prisma.delivery.findUnique({
    where: { id },
    include: {
      order: {
        include: {
          customer: true,
          lead: true,
          lines: { include: { product: true } },
          job: { include: { technicians: { select: { id: true } } } },
        },
      },
    },
  });
  if (!delivery) return res.status(404).json({ error: 'Delivery not found' });
  if (delivery.status !== 'PENDING') return res.status(400).json({ error: 'This kit was already dispatched' });

  const order = delivery.order;
  if (order.status !== 'CONFIRMED') return res.status(400).json({ error: 'The order is not confirmed' });
  const serialLines = order.lines.filter((l) => l.product.isSerialized);

  // Check every scanned serial
  const units = await prisma.serialUnit.findMany({ where: { serialNo: { in: scanned } }, include: { product: true } });
  const bySerial = new Map(units.map((u) => [u.serialNo, u]));
  for (const serial of scanned) {
    const unit = bySerial.get(serial);
    if (!unit) return res.status(400).json({ error: `${serial} is not in the system` });
    if (unit.status !== 'IN_STOCK') return res.status(400).json({ error: `${serial} is not in stock (${unit.status})` });
    if (unit.orderId && unit.orderId !== order.id) {
      return res.status(400).json({ error: `${serial} is reserved for order #${unit.orderId}` });
    }
    if (!serialLines.some((l) => l.productId === unit.productId)) {
      return res.status(400).json({ error: `${serial} (${unit.product.name}) is not part of this order` });
    }
  }
  // Right number of each item?
  for (const line of serialLines) {
    const count = units.filter((u) => u.productId === line.productId).length;
    if (count !== line.qty) return res.status(400).json({ error: `${line.description}: scanned ${count} of ${line.qty}` });
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    // 1. Units reserved for this order but not scanned go back to free stock
    await tx.serialUnit.updateMany({
      where: { orderId: order.id, status: 'IN_STOCK', serialNo: { notIn: scanned } },
      data: { orderId: null },
    });

    // 2. Each scanned unit now belongs to this customer and its warranty clock starts
    for (const line of serialLines) {
      const serials = units.filter((u) => u.productId === line.productId).map((u) => u.serialNo);
      const updated = await tx.serialUnit.updateMany({
        where: { serialNo: { in: serials }, status: 'IN_STOCK', OR: [{ orderId: null }, { orderId: order.id }] },
        data: {
          status: 'DELIVERED',
          orderId: order.id,
          customerId: order.customerId,
          deliveredAt: now,
          warrantyEnd: addMonths(now, line.product.warrantyMonths),
        },
      });
      if (updated.count !== serials.length) {
        const err = new Error('Some serials were just taken by another dispatch. Reload and scan again.');
        err.status = 409;
        throw err;
      }
    }

    await tx.delivery.update({ where: { id }, data: { status: 'DISPATCHED', dispatchedAt: now, dispatchedById: req.user.id } });
    await tx.salesOrder.update({ where: { id: order.id }, data: { status: 'DISPATCHED' } });

    const message = `Kit for ${order.customer.name} (order #${order.id}) dispatched`;
    for (const t of order.job?.technicians || []) await notify(tx, t.id, `${message}. Ready to install.`, '/my-jobs');
    if (order.lead?.assignedToId) await notify(tx, order.lead.assignedToId, message, `/orders/${order.id}`);
  });

  res.json({ ok: true, dispatched: scanned.length });
});

// GET /api/inventory/serials/:serialNo → where is this unit, and is it under warranty?
router.get('/serials/:serialNo', requireRole('WAREHOUSE', 'SERVICE'), async (req, res) => {
  const unit = await prisma.serialUnit.findUnique({
    where: { serialNo: cleanSerial(req.params.serialNo) },
    include: {
      product: { select: { name: true, sku: true, category: true, warrantyMonths: true } },
      customer: { select: { id: true, name: true, phone: true, address: true, city: true } },
      order: { select: { id: true, status: true, kit: { select: { name: true } } } },
    },
  });
  if (!unit) return res.status(404).json({ error: 'No unit with that serial number' });

  const inWarranty = unit.warrantyEnd ? unit.warrantyEnd > new Date() : null;
  res.json({ ...unit, inWarranty });
});

export default router;
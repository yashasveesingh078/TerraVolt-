import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notify, notifyRole } from '../services/notify.js';
import { getSettings } from '../services/sizing.js';
import { availability, reserveForOrder } from '../services/stock.js';
const router = Router();
router.use(requireAuth, requireRole('SALES', 'ACCOUNTS'));

const ORDER_STATUSES = ['QUOTE', 'ACCEPTED', 'CONFIRMED', 'DISPATCHED', 'INSTALLED', 'CLOSED', 'CANCELLED'];
const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
const money = (n) => Math.round(n * 100) / 100;

// POST /api/orders/from-lead/:leadId → build a quotation from the lead's approved kit
router.post('/from-lead/:leadId', requireRole('SALES'), async (req, res) => {
  const leadId = readId(req.params.leadId);
  if (!leadId) return res.status(400).json({ error: 'Invalid lead id' });

  const lead = await prisma.lead.findUnique({ where: { id: leadId }, include: { customer: true, order: true } });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.order) return res.status(400).json({ error: 'This lead already has a quotation' });
  if (lead.status !== 'SURVEY_APPROVED') {
    return res.status(400).json({ error: 'A quotation needs an approved site survey first' });
  }
  if (!lead.recommendedKitId) {
    return res.status(400).json({ error: 'No kit matches the surveyed size. Set up a kit first.' });
  }

  const kit = await prisma.kit.findUnique({
    where: { id: lead.recommendedKitId },
    include: { items: { include: { product: true } } },
  });
  const settings = await getSettings();
  const gstPercent = Number(settings.gst_percent ?? 12);

  // Copy prices into the order lines: later price changes never alter a sent quote
  const lines = kit.items.map((item) => {
    const unitPrice = Number(item.product.salePrice);
    return {
      productId: item.productId,
      description: item.product.name,
      qty: item.qty,
      unitPrice,
      unitCost: Number(item.product.costPrice),
      lineTotal: money(unitPrice * item.qty),
    };
  });
  const subtotal = money(lines.reduce((sum, l) => sum + l.lineTotal, 0));
  const taxAmount = Math.round((subtotal * gstPercent) / 100);
  const total = money(subtotal + taxAmount);

  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.salesOrder.create({
      data: {
        customerId: lead.customerId,
        leadId,
        kitId: kit.id,
        status: 'QUOTE',
        subtotal,
        taxAmount,
        total,
        installAddress: [lead.customer.address, lead.customer.city, lead.customer.pincode].filter(Boolean).join(', '),
        lines: { create: lines },
      },
    });
    await tx.lead.update({ where: { id: leadId }, data: { status: 'QUOTED' } });
    return created;
  });

  res.status(201).json(order);
});

// GET /api/orders?status=ACCEPTED
router.get('/', async (req, res) => {
  const where = ORDER_STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  const orders = await prisma.salesOrder.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      customer: { select: { name: true, phone: true, city: true } },
      kit: { select: { name: true, kw: true, type: true } },
    },
  });
  res.json(orders);
});

// GET /api/orders/:id
router.get('/:id', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid order id' });

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      kit: { select: { name: true, kw: true, type: true } },
      lines: {
        orderBy: { id: 'asc' },
        include: { product: { select: { id: true, sku: true, stockQty: true, isSerialized: true, category: true } } },
      },
      invoices: { orderBy: { issueDate: 'asc' }, include: { payments: true } },
      delivery: true,
      job: { include: { technicians: { select: { id: true, name: true } } } },
    },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const avail = await availability(prisma, order.lines.map((l) => l.product));
  const settings = await getSettings();
  res.json({
    ...order,
    lines: order.lines.map((l) => ({ ...l, available: avail[l.productId] })),
    advancePercent: Number(settings.advance_percent ?? 30),
  });
});

// POST /api/orders/:id/confirm  { amount, method, reference }
// Records the advance, reserves stock and hands the order to warehouse + technician
// POST /api/orders/:id/confirm  { amount, method, reference }
router.post('/:id/confirm', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid order id' });

  const { amount, method, reference } = req.body ?? {};
  const paid = Number(amount);

  const order = await prisma.salesOrder.findUnique({
    where: { id },
    include: { lines: { include: { product: true } }, customer: true, lead: { include: { survey: true } } },
  });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'ACCEPTED') {
    return res.status(400).json({ error: 'The customer must accept the quotation before it can be confirmed' });
  }
  if (!(paid > 0 && paid <= Number(order.total))) {
    return res.status(400).json({ error: 'Advance must be more than 0 and not more than the order total' });
  }
  if (!PAYMENT_METHODS.includes(method)) return res.status(400).json({ error: 'Choose a payment method' });

  const avail = await availability(prisma, order.lines.map((l) => l.product));
  const short = order.lines
    .filter((l) => avail[l.productId] !== null && avail[l.productId] < l.qty)
    .map((l) => `${l.description} (need ${l.qty}, have ${avail[l.productId]})`);
  if (short.length > 0) return res.status(400).json({ error: `Not enough stock: ${short.join('; ')}` });

  const result = await prisma.$transaction(async (tx) => {
    await reserveForOrder(tx, id, order.lines); // throws (and rolls everything back) if stock runs out

    const invoiceCount = await tx.invoice.count();
    const invoice = await tx.invoice.create({
      data: {
        number: `INV-${new Date().getFullYear()}-${String(invoiceCount + 1).padStart(4, '0')}`,
        type: 'ADVANCE',
        status: 'PAID',
        customerId: order.customerId,
        orderId: id,
        amount: paid,
        sentAt: new Date(),
        payments: { create: { amount: paid, method, reference: reference ? String(reference).trim() : null } },
      },
    });

    const confirmed = await tx.salesOrder.update({ where: { id }, data: { status: 'CONFIRMED', confirmedAt: new Date() } });
    if (order.leadId) await tx.lead.update({ where: { id: order.leadId }, data: { status: 'WON' } });

    await tx.delivery.create({ data: { orderId: id } });
    const technicianId = order.lead?.survey?.technicianId;
    await tx.installJob.create({
      data: { orderId: id, ...(technicianId ? { technicians: { connect: [{ id: technicianId }] } } : {}) },
    });

    await notifyRole(tx, 'WAREHOUSE', `Order #${id} for ${order.customer.name} confirmed. Pack the kit.`, '/inventory');
    if (technicianId) await notify(tx, technicianId, `New installation for ${order.customer.name} (order #${id})`, '/my-jobs');
    return { order: confirmed, invoice };
  });

  res.json(result);
});

export default router;
import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notify, notifyRole } from '../services/notify.js';
import { getSettings } from '../services/sizing.js';

const router = Router();
router.use(requireAuth, requireRole('SERVICE'));

const TICKET_STATUSES = ['OPEN', 'DIAGNOSED', 'IN_REPAIR', 'AWAITING_CUSTOMER', 'CLOSED'];
const MOVES = { OPEN: ['DIAGNOSED'], DIAGNOSED: ['IN_REPAIR'], IN_REPAIR: ['AWAITING_CUSTOMER'], AWAITING_CUSTOMER: ['IN_REPAIR'] };

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
const money = (n) => Math.round(n * 100) / 100;
const cleanSerial = (s) => String(s ?? '').trim().toUpperCase();
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// ★ The warranty rule, in ONE place. The decision and the reason are saved on the ticket.
function decideWarranty(unit, faultDate) {
  const d = (x) => x.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  if (!unit.warrantyEnd) {
    return { underWarranty: false, warrantyReason: 'Unit has no warranty start date' };
  }
  if (faultDate <= unit.warrantyEnd) {
    return {
      underWarranty: true,
      warrantyReason: `Fault on ${d(faultDate)} is within the ${unit.product.warrantyMonths}-month warranty (ends ${d(unit.warrantyEnd)})`,
    };
  }
  return { underWarranty: false, warrantyReason: `Warranty ended on ${d(unit.warrantyEnd)}; fault reported on ${d(faultDate)}` };
}

// Opening repair work moves an OPEN/DIAGNOSED ticket to IN_REPAIR
async function moveToRepair(tx, ticket) {
  if (ticket.status === 'OPEN' || ticket.status === 'DIAGNOSED') {
    await tx.ticket.update({ where: { id: ticket.id }, data: { status: 'IN_REPAIR' } });
  }
}

const ticketInclude = {
  serialUnit: { include: { product: { select: { id: true, name: true, sku: true, warrantyMonths: true } } } },
  customer: { select: { id: true, name: true, phone: true, address: true, city: true } },
  assignedTo: { select: { id: true, name: true } },
};

// GET /api/tickets/parts → spare parts for the repair form (must be above /:id)
router.get('/parts', async (req, res) => {
  const parts = await prisma.product.findMany({
    where: { category: { not: 'SERVICE' } },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, sku: true, isSerialized: true, salePrice: true },
  });
  res.json(parts);
});

// GET /api/tickets?status=OPEN
router.get('/', async (req, res) => {
  const where = TICKET_STATUSES.includes(req.query.status) ? { status: req.query.status } : {};
  const tickets = await prisma.ticket.findMany({ where, orderBy: { createdAt: 'desc' }, take: 200, include: ticketInclude });
  res.json(tickets);
});

// GET /api/tickets/:id
router.get('/:id', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ticket id' });
  const ticket = await prisma.ticket.findUnique({
    where: { id },
    include: { ...ticketInclude, repairLines: { orderBy: { id: 'asc' } }, invoice: { include: { payments: true } } },
  });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });

  const settings = await getSettings();
  res.json({ ...ticket, labourRate: Number(settings.labour_rate ?? 500), gstPercent: Number(settings.gst_percent ?? 12) });
});

// POST /api/tickets  { serialNo, fault, faultDate, assignedToId? }
router.post('/', async (req, res) => {
  const body = req.body ?? {};
  const fault = String(body.fault ?? '').trim();
  const faultDate = body.faultDate ? new Date(body.faultDate) : new Date();
  if (fault.length < 5) return res.status(400).json({ error: 'Describe the fault (at least 5 characters)' });
  if (Number.isNaN(faultDate.getTime()) || faultDate > new Date()) {
    return res.status(400).json({ error: 'Fault date cannot be in the future' });
  }

  const unit = await prisma.serialUnit.findUnique({ where: { serialNo: cleanSerial(body.serialNo) }, include: { product: true } });
  if (!unit) return res.status(404).json({ error: 'No unit with that serial number' });
  if (unit.status !== 'DELIVERED' || !unit.customerId) {
    return res.status(400).json({ error: `This unit is not installed at a customer (${unit.status})` });
  }
  if (unit.deliveredAt) {
    const deliveredDay = new Date(unit.deliveredAt);
    deliveredDay.setHours(0, 0, 0, 0);
    if (faultDate < deliveredDay) return res.status(400).json({ error: 'Fault date is before the unit was delivered' });
  }

  let assignedToId = null;
  if (body.assignedToId) {
    const tech = await prisma.user.findFirst({ where: { id: Number(body.assignedToId), role: 'TECHNICIAN', active: true } });
    if (!tech) return res.status(400).json({ error: 'Unknown technician' });
    assignedToId = tech.id;
  }

  const decision = decideWarranty(unit, faultDate);
  const ticket = await prisma.$transaction(async (tx) => {
    const created = await tx.ticket.create({
      data: { serialUnitId: unit.id, customerId: unit.customerId, assignedToId, fault, faultDate, ...decision },
    });
    if (assignedToId) {
      await notify(tx, assignedToId, `Service visit: ${unit.product.name} ${unit.serialNo} (ticket #${created.id})`, null);
    }
    return created;
  });

  res.status(201).json(ticket);
});

// PATCH /api/tickets/:id  { status?, assignedToId?, faultCode? }
router.patch('/:id', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ticket id' });
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status === 'CLOSED') return res.status(400).json({ error: 'This ticket is closed' });

  const { status, assignedToId, faultCode } = req.body ?? {};
  const data = {};
  if (status !== undefined && status !== ticket.status) {
    if (!(MOVES[ticket.status] || []).includes(status)) {
      return res.status(400).json({ error: `Cannot move a ticket from ${ticket.status} to ${status}` });
    }
    data.status = status;
  }
  if (faultCode !== undefined) data.faultCode = faultCode ? String(faultCode).trim() : null;
  if (assignedToId !== undefined) {
    if (!assignedToId) data.assignedToId = null;
    else {
      const tech = await prisma.user.findFirst({ where: { id: Number(assignedToId), role: 'TECHNICIAN', active: true } });
      if (!tech) return res.status(400).json({ error: 'Unknown technician' });
      data.assignedToId = tech.id;
    }
  }

  const updated = await prisma.ticket.update({ where: { id }, data });
  res.json(updated);
});

// POST /api/tickets/:id/lines
//   LABOUR: { type, description, qty (hours) }
//   PART (loose): { type, productId, qty }
//   PART (serial-tracked): { type, productId, replacementSerial } → swaps the faulty unit
router.post('/:id/lines', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ticket id' });
  const ticket = await prisma.ticket.findUnique({ where: { id }, include: { serialUnit: true, assignedTo: true } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status === 'CLOSED') return res.status(400).json({ error: 'This ticket is closed' });

  const body = req.body ?? {};
  const free = ticket.underWarranty; // ★ under warranty → the customer is charged nothing

  if (body.type === 'LABOUR') {
    const hours = Number(body.qty);
    if (!(hours > 0 && hours <= 24)) return res.status(400).json({ error: 'Labour hours must be between 0.5 and 24' });
    const settings = await getSettings();
    const labourRate = Number(settings.labour_rate ?? 500);

    const line = await prisma.$transaction(async (tx) => {
      const created = await tx.repairLine.create({
        data: {
          ticketId: id,
          type: 'LABOUR',
          description: String(body.description || 'Service labour').trim(),
          qty: hours,
          cost: money(hours * Number(ticket.assignedTo?.hourlyRate ?? 0)),
          priceCharged: free ? 0 : money(hours * labourRate),
        },
      });
      if (ticket.assignedToId) {
        await tx.timeLog.create({ data: { technicianId: ticket.assignedToId, ticketId: id, workDate: new Date(), hours } });
      }
      await moveToRepair(tx, ticket);
      return created;
    });
    return res.status(201).json(line);
  }

  if (body.type !== 'PART') return res.status(400).json({ error: 'Choose part or labour' });
  const product = await prisma.product.findUnique({ where: { id: readId(body.productId) ?? 0 } });
  if (!product || product.category === 'SERVICE') return res.status(400).json({ error: 'Choose a part' });

  if (product.isSerialized) {
    const old = ticket.serialUnit;
    if (product.id !== old.productId) {
      return res.status(400).json({ error: 'A serial-tracked replacement must be the same model as the faulty unit' });
    }
    if (old.status !== 'DELIVERED') return res.status(400).json({ error: `${old.serialNo} was already replaced` });
    const newUnit = await prisma.serialUnit.findUnique({ where: { serialNo: cleanSerial(body.replacementSerial) } });
    if (!newUnit || newUnit.productId !== product.id) {
      return res.status(400).json({ error: `Scan the serial of the new ${product.name}` });
    }
    if (newUnit.status !== 'IN_STOCK' || newUnit.orderId) {
      return res.status(400).json({ error: `${newUnit.serialNo} is not free stock` });
    }

    const now = new Date();
    const line = await prisma.$transaction(async (tx) => {
      const taken = await tx.serialUnit.updateMany({
        where: { id: newUnit.id, status: 'IN_STOCK', orderId: null },
        data: {
          status: 'DELIVERED',
          orderId: old.orderId,
          customerId: old.customerId,
          deliveredAt: now,
          // Warranty swap keeps the original end date; a paid replacement gets a fresh warranty
          warrantyEnd: free ? old.warrantyEnd : addMonths(now, product.warrantyMonths),
        },
      });
      if (taken.count !== 1) throw httpError(409, `${newUnit.serialNo} was just taken. Scan another unit.`);
      await tx.serialUnit.update({ where: { id: old.id }, data: { status: 'REPLACED' } });

      const created = await tx.repairLine.create({
        data: {
          ticketId: id,
          type: 'PART',
          productId: product.id,
          description: `${product.name}: replaced ${old.serialNo} with ${newUnit.serialNo}`,
          qty: 1,
          cost: Number(product.costPrice),
          priceCharged: free ? 0 : Number(product.salePrice),
        },
      });
      await moveToRepair(tx, ticket);
      return created;
    });
    return res.status(201).json(line);
  }

  const qty = Number(body.qty);
  if (!Number.isInteger(qty) || qty < 1 || qty > 1000) return res.status(400).json({ error: 'Enter a quantity' });

  const line = await prisma.$transaction(async (tx) => {
    const updated = await tx.product.updateMany({
      where: { id: product.id, stockQty: { gte: qty } },
      data: { stockQty: { decrement: qty } },
    });
    if (updated.count === 0) throw httpError(400, `Not enough ${product.name} in stock`);
    const created = await tx.repairLine.create({
      data: {
        ticketId: id,
        type: 'PART',
        productId: product.id,
        description: product.name,
        qty,
        cost: money(Number(product.costPrice) * qty),
        priceCharged: free ? 0 : money(Number(product.salePrice) * qty),
      },
    });
    await moveToRepair(tx, ticket);
    return created;
  });
  res.status(201).json(line);
});

// POST /api/tickets/:id/close  { confirmedByName }
router.post('/:id/close', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid ticket id' });
  const name = String(req.body?.confirmedByName ?? '').trim();
  if (name.length < 2) return res.status(400).json({ error: "Type the customer's name to confirm the repair" });

  const ticket = await prisma.ticket.findUnique({ where: { id }, include: { repairLines: true, customer: true } });
  if (!ticket) return res.status(404).json({ error: 'Ticket not found' });
  if (ticket.status === 'CLOSED') return res.status(400).json({ error: 'Already closed' });
  if (ticket.repairLines.length === 0) return res.status(400).json({ error: 'Add the repair work before closing' });

  const settings = await getSettings();
  const gstPercent = Number(settings.gst_percent ?? 12);
  const dueDays = Number(settings.invoice_due_days ?? 15);
  const charged = ticket.repairLines.reduce((sum, l) => sum + Number(l.priceCharged), 0);
  const now = new Date();

  const result = await prisma.$transaction(async (tx) => {
    const closed = await tx.ticket.update({
      where: { id },
      data: { status: 'CLOSED', closedAt: now, customerConfirmedAt: now, confirmedByName: name },
    });

    // Only chargeable repairs produce an invoice
    let invoice = null;
    if (charged > 0) {
      const count = await tx.invoice.count();
      invoice = await tx.invoice.create({
        data: {
          number: `INV-${now.getFullYear()}-${String(count + 1).padStart(4, '0')}`,
          type: 'REPAIR',
          status: 'SENT',
          customerId: ticket.customerId,
          ticketId: id,
          amount: money(charged + Math.round((charged * gstPercent) / 100)),
          sentAt: now,
          dueDate: new Date(now.getTime() + dueDays * 24 * 60 * 60 * 1000),
        },
      });
      await notifyRole(tx, 'ACCOUNTS', `Repair invoice ${invoice.number} for ${ticket.customer.name}`, '/invoices');
    }
    return { ticket: closed, invoice };
  });

  res.json(result);
});

export default router;
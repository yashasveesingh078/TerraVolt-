import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { getSettings } from '../services/sizing.js';
import { money } from '../services/period.js';

const router = Router();
router.use(requireAuth, requireRole('ACCOUNTS'));

const PAYMENT_METHODS = ['CASH', 'UPI', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
const paidOf = (invoice) => invoice.payments.reduce((sum, p) => sum + Number(p.amount), 0);
const withBalance = (invoice) => {
  const paid = paidOf(invoice);
  return { ...invoice, paid: money(paid), balance: money(Number(invoice.amount) - paid) };
};

// GET /api/invoices/ready → installed orders that still need a final invoice
router.get('/ready', async (req, res) => {
  const orders = await prisma.salesOrder.findMany({
    where: { status: 'INSTALLED', invoices: { none: { type: 'FINAL' } } },
    orderBy: { updatedAt: 'asc' },
    include: {
      customer: { select: { name: true } },
      kit: { select: { name: true } },
      invoices: { select: { type: true, amount: true } },
    },
  });
  res.json(
    orders.map((o) => {
      const advance = o.invoices.filter((i) => i.type === 'ADVANCE').reduce((s, i) => s + Number(i.amount), 0);
      return { id: o.id, customer: o.customer, kit: o.kit, total: o.total, advance, due: money(Number(o.total) - advance) };
    }),
  );
});

// GET /api/invoices?status=SENT
router.get('/', async (req, res) => {
  const where = ['DRAFT', 'SENT', 'PAID'].includes(req.query.status) ? { status: req.query.status } : {};
  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { issueDate: 'desc' },
    take: 300,
    include: { customer: { select: { name: true, phone: true } }, payments: { orderBy: { paidAt: 'asc' } } },
  });
  res.json(invoices.map(withBalance));
});

// POST /api/invoices/final/:orderId → bill the balance after installation
router.post('/final/:orderId', async (req, res) => {
  const orderId = readId(req.params.orderId);
  if (!orderId) return res.status(400).json({ error: 'Invalid order id' });

  const order = await prisma.salesOrder.findUnique({ where: { id: orderId }, include: { invoices: true, lead: true } });
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.status !== 'INSTALLED') return res.status(400).json({ error: 'Raise the final invoice after installation' });
  if (order.invoices.some((i) => i.type === 'FINAL')) return res.status(400).json({ error: 'Final invoice already raised' });

  const advance = order.invoices.filter((i) => i.type === 'ADVANCE').reduce((s, i) => s + Number(i.amount), 0);
  const due = money(Number(order.total) - advance);
  if (due <= 0) return res.status(400).json({ error: 'Nothing left to bill on this order' });

  const settings = await getSettings();
  const dueDays = Number(settings.invoice_due_days ?? 15);

  const invoice = await prisma.$transaction(async (tx) => {
    const count = await tx.invoice.count();
    const created = await tx.invoice.create({
      data: {
        number: `INV-${new Date().getFullYear()}-${String(count + 1).padStart(4, '0')}`,
        type: 'FINAL',
        status: 'SENT',
        customerId: order.customerId,
        orderId,
        amount: due,
        sentAt: new Date(),
        dueDate: new Date(Date.now() + dueDays * 24 * 60 * 60 * 1000),
      },
    });
    // Customers who asked for the government subsidy get a tracker automatically
    if (order.lead?.wantsSubsidy) {
      await tx.subsidy.upsert({ where: { orderId }, create: { orderId, scheme: 'PM Surya Ghar' }, update: {} });
    }
    return created;
  });

  res.status(201).json(invoice);
});

// POST /api/invoices/:id/payments  { amount, method, reference }
router.post('/:id/payments', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid invoice id' });

  const invoice = await prisma.invoice.findUnique({ where: { id }, include: { payments: true, order: true } });
  if (!invoice) return res.status(404).json({ error: 'Invoice not found' });
  if (invoice.status === 'PAID') return res.status(400).json({ error: 'This invoice is already paid' });

  const { amount, method, reference } = req.body ?? {};
  const pay = Number(amount);
  const balance = money(Number(invoice.amount) - paidOf(invoice));
  if (!(pay > 0 && pay <= balance)) return res.status(400).json({ error: `Amount must be between 1 and ${balance}` });
  if (!PAYMENT_METHODS.includes(method)) return res.status(400).json({ error: 'Choose a payment method' });

  const updated = await prisma.$transaction(async (tx) => {
    await tx.payment.create({
      data: { invoiceId: id, amount: pay, method, reference: reference ? String(reference).trim() : null },
    });
    const fullyPaid = pay >= balance;
    const saved = await tx.invoice.update({ where: { id }, data: { status: fullyPaid ? 'PAID' : 'SENT' } });
    // Final invoice settled → the order's lifecycle is complete
    if (fullyPaid && invoice.type === 'FINAL' && invoice.order?.status === 'INSTALLED') {
      await tx.salesOrder.update({ where: { id: invoice.orderId }, data: { status: 'CLOSED' } });
    }
    return saved;
  });

  res.json(updated);
});

export default router;
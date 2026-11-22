import { Router } from 'express';
import prisma from '../db.js';
import { estimateSystem, getSettings } from '../services/sizing.js';
import { notify, notifyRole } from '../services/notify.js';
const router = Router();

const GRID_OPTIONS = ['RELIABLE', 'FREQUENT_CUTS', 'NO_GRID'];

// Check and clean the three sizing inputs. Returns { error } or the clean values.
function readSizingInput(body) {
  const monthlyBill = Number(body.monthlyBill);
  const roofAreaSqft = Math.round(Number(body.roofAreaSqft));
  const { gridReliability } = body;

  if (!Number.isFinite(monthlyBill) || monthlyBill <= 0 || monthlyBill > 200000) {
    return { error: 'Enter your average monthly electricity bill in ₹' };
  }
  if (!Number.isFinite(roofAreaSqft) || roofAreaSqft <= 0 || roofAreaSqft > 100000) {
    return { error: 'Enter your shadow-free roof area in square feet' };
  }
  if (!GRID_OPTIONS.includes(gridReliability)) {
    return { error: 'Choose how reliable your electricity supply is' };
  }
  return { monthlyBill, roofAreaSqft, gridReliability };
}

// POST /api/public/estimate  → instant estimate, nothing is saved
router.post('/estimate', async (req, res) => {
  const input = readSizingInput(req.body);
  if (input.error) return res.status(400).json({ error: input.error });

  const estimate = await estimateSystem(input);
  res.json(estimate);
});

// POST /api/public/enquiry  → save the customer + lead, notify sales
router.post('/enquiry', async (req, res) => {
  const input = readSizingInput(req.body);
  if (input.error) return res.status(400).json({ error: input.error });

  const name = String(req.body.name || '').trim();
  const address = String(req.body.address || '').trim();
  const email = String(req.body.email || '').trim().toLowerCase() || null;
  const city = String(req.body.city || '').trim() || null;
  const pincode = String(req.body.pincode || '').trim() || null;
  const wantsSubsidy = Boolean(req.body.wantsSubsidy);
  // Keep only digits, then the last 10 (so "+91 98765-43210" works)
  const phone = String(req.body.phone || '').replace(/\D/g, '').slice(-10);

  if (name.length < 2) return res.status(400).json({ error: 'Enter your name' });
  if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number' });
  if (address.length < 5) return res.status(400).json({ error: 'Enter your installation address' });
  if (pincode && !/^\d{6}$/.test(pincode)) return res.status(400).json({ error: 'Pincode must be 6 digits' });

  // Recalculate on the server: never trust numbers sent by the browser
  const estimate = await estimateSystem(input);

  // Pick a sales person to own the lead (first active sales user)
  const salesPerson = await prisma.user.findFirst({
    where: { role: 'SALES', active: true },
    orderBy: { id: 'asc' },
  });

  // Save everything together: all of it succeeds, or none of it is saved
  const lead = await prisma.$transaction(async (tx) => {
    // Same phone = same customer: update their details instead of creating a duplicate
    const customer = await tx.customer.upsert({
      where: { phone },
      update: { name, email, address, city, pincode },
      create: { name, phone, email, address, city, pincode },
    });

    const newLead = await tx.lead.create({
      data: {
        customerId: customer.id,
        source: 'WEB',
        status: 'NEW',
        monthlyBill: input.monthlyBill,
        roofAreaSqft: input.roofAreaSqft,
        gridReliability: input.gridReliability,
        wantsSubsidy,
        recommendedKw: estimate.feasible ? estimate.kw : null,
        recommendedType: estimate.feasible ? estimate.systemType : null,
        recommendedKitId: estimate.feasible ? estimate.kit.id : null,
        assignedToId: salesPerson ? salesPerson.id : null,
        notes: estimate.feasible ? null : estimate.reason,
      },
    });

    if (salesPerson) {
      await tx.notification.create({
        data: {
          userId: salesPerson.id,
          message: estimate.feasible
            ? `New web enquiry from ${name}: ${estimate.kit.name}`
            : `New web enquiry from ${name}: roof may be too small, please call`,
          link: `/leads/${newLead.id}`,
        },
      });
    }

    return newLead;
  });

  res.status(201).json({
    leadId: lead.id,
    reference: `ENQ-${String(lead.id).padStart(5, '0')}`,
    estimate,
  });
});
// GET /api/public/quote/:token → what the customer sees. Never cost prices!
router.get('/quote/:token', async (req, res) => {
  const order = await prisma.salesOrder.findUnique({
    where: { quoteToken: req.params.token },
    select: {
      id: true,
      status: true,
      subtotal: true,
      taxAmount: true,
      total: true,
      installAddress: true,
      acceptedAt: true,
      acceptedByName: true,
      createdAt: true,
      customer: { select: { name: true } },
      kit: { select: { name: true, kw: true, type: true } },
      lines: { orderBy: { id: 'asc' }, select: { id: true, description: true, qty: true, unitPrice: true, lineTotal: true } },
    },
  });
  if (!order) return res.status(404).json({ error: 'Quotation not found' });

  const settings = await getSettings();
  res.json({ ...order, companyName: settings.company_name || 'TerraVolt', gstPercent: Number(settings.gst_percent ?? 12) });
});

// POST /api/public/quote/:token/accept  { name }
router.post('/quote/:token/accept', async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Type your full name to accept' });

  const order = await prisma.salesOrder.findUnique({
    where: { quoteToken: req.params.token },
    include: { customer: true, lead: true },
  });
  if (!order) return res.status(404).json({ error: 'Quotation not found' });
  if (order.status !== 'QUOTE') return res.status(400).json({ error: 'This quotation has already been accepted' });

  await prisma.$transaction(async (tx) => {
    await tx.salesOrder.update({
      where: { id: order.id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), acceptedByName: name },
    });
    const message = `${order.customer.name} accepted quotation #${order.id}. Collect the advance.`;
    if (order.lead?.assignedToId) await notify(tx, order.lead.assignedToId, message, `/orders/${order.id}`);
    else await notifyRole(tx, 'SALES', message, `/orders/${order.id}`);
    await notifyRole(tx, 'ACCOUNTS', message, `/orders/${order.id}`);
  });

  res.json({ ok: true });
});
export default router;
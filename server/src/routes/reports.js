import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { monthRange, money } from '../services/period.js';

const router = Router();
router.use(requireAuth, requireRole('DIRECTOR'));

// GET /api/reports/monthly?month=2026-11
router.get('/monthly', async (req, res) => {
  const { start, end, label } = monthRange(req.query.month);
  const inMonth = { gte: start, lt: end };

  const [newLeads, confirmedOrders, invoiced, collected, ticketsOpened, warrantyThisMonth, jobs] = await Promise.all([
    prisma.lead.count({ where: { createdAt: inMonth } }),
    prisma.salesOrder.count({ where: { confirmedAt: inMonth } }),
    prisma.invoice.aggregate({ where: { issueDate: inMonth }, _sum: { amount: true } }),
    prisma.payment.aggregate({ where: { paidAt: inMonth }, _sum: { amount: true } }),
    prisma.ticket.count({ where: { createdAt: inMonth } }),
    prisma.repairLine.aggregate({ where: { ticket: { underWarranty: true, createdAt: inMonth } }, _sum: { cost: true } }),
    prisma.installJob.findMany({
      where: { status: 'COMPLETED', finishedAt: inMonth },
      orderBy: { finishedAt: 'asc' },
      include: {
        timeLogs: { include: { technician: { select: { hourlyRate: true } } } },
        order: { include: { customer: { select: { name: true } }, kit: { select: { name: true } }, lines: true } },
      },
    }),
  ]);

  // ★ Warranty repairs on each roof: free for the customer, but parts + labour still cost us
  const orderIds = jobs.map((j) => j.orderId);
  const warrantyTickets = orderIds.length
    ? await prisma.ticket.findMany({
        where: { underWarranty: true, serialUnit: { orderId: { in: orderIds } } },
        include: { repairLines: { select: { cost: true } }, serialUnit: { select: { orderId: true } } },
      })
    : [];
  const warrantyBy = {};
  for (const t of warrantyTickets) {
    const cost = t.repairLines.reduce((s, l) => s + Number(l.cost), 0);
    warrantyBy[t.serialUnit.orderId] = (warrantyBy[t.serialUnit.orderId] || 0) + cost;
  }

  const jobRows = jobs.map((job) => {
    const order = job.order;
    const revenue = Number(order.subtotal); // excluding GST: GST is collected for the government, not income
    const materials = order.lines.reduce((s, l) => s + Number(l.unitCost) * l.qty, 0);
    const labour = job.timeLogs.reduce((s, l) => s + Number(l.hours) * Number(l.technician.hourlyRate), 0);
    const warranty = warrantyBy[order.id] || 0;
    const profit = revenue - materials - labour - warranty;
    return {
      jobId: job.id,
      orderId: order.id,
      customer: order.customer.name,
      kit: order.kit?.name,
      finishedAt: job.finishedAt,
      revenue: money(revenue),
      materials: money(materials),
      labour: money(labour),
      warranty: money(warranty),
      profit: money(profit),
      margin: revenue > 0 ? Number(((profit / revenue) * 100).toFixed(1)) : 0,
    };
  });

  const totals = jobRows.reduce(
    (t, r) => {
      for (const key of ['revenue', 'materials', 'labour', 'warranty', 'profit']) t[key] = money(t[key] + r[key]);
      return t;
    },
    { revenue: 0, materials: 0, labour: 0, warranty: 0, profit: 0 },
  );

  res.json({
    month: label,
    newLeads,
    confirmedOrders,
    installs: jobs.length,
    ticketsOpened,
    invoiced: Number(invoiced._sum.amount || 0),
    collected: Number(collected._sum.amount || 0),
    warrantyCostThisMonth: Number(warrantyThisMonth._sum.cost || 0),
    jobs: jobRows,
    totals,
  });
});

export default router;
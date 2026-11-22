import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { monthRange, money } from '../services/period.js';

const router = Router();
router.use(requireAuth, requireRole('ACCOUNTS'));

// GET /api/payroll?month=2026-11 → hours × rate per technician (+ whether already paid)
router.get('/', async (req, res) => {
  const { start, end, label } = monthRange(req.query.month);

  const [technicians, logs, payouts] = await Promise.all([
    prisma.user.findMany({ where: { role: 'TECHNICIAN' }, orderBy: { name: 'asc' }, select: { id: true, name: true, hourlyRate: true } }),
    prisma.timeLog.groupBy({ by: ['technicianId'], where: { workDate: { gte: start, lt: end } }, _sum: { hours: true } }),
    prisma.technicianPayout.findMany({ where: { periodStart: start } }),
  ]);
  const hoursBy = Object.fromEntries(logs.map((l) => [l.technicianId, Number(l._sum.hours || 0)]));
  const payoutBy = Object.fromEntries(payouts.map((p) => [p.technicianId, p]));

  res.json({
    month: label,
    rows: technicians.map((t) => {
      const payout = payoutBy[t.id];
      const hours = payout ? Number(payout.hours) : hoursBy[t.id] || 0;
      return {
        technicianId: t.id,
        name: t.name,
        rate: Number(t.hourlyRate),
        hours,
        amount: payout ? Number(payout.amount) : money(hours * Number(t.hourlyRate)),
        paidAt: payout?.paidAt ?? null,
      };
    }),
  });
});

// POST /api/payroll/pay  { technicianId, month }
router.post('/pay', async (req, res) => {
  const { start, end } = monthRange(req.body?.month);
  const technicianId = Number(req.body?.technicianId);

  const tech = await prisma.user.findFirst({ where: { id: Number.isInteger(technicianId) ? technicianId : 0, role: 'TECHNICIAN' } });
  if (!tech) return res.status(404).json({ error: 'Technician not found' });

  const existing = await prisma.technicianPayout.findFirst({ where: { technicianId, periodStart: start } });
  if (existing) return res.status(400).json({ error: `${tech.name} is already paid for this month` });

  const sum = await prisma.timeLog.aggregate({
    where: { technicianId, workDate: { gte: start, lt: end } },
    _sum: { hours: true },
  });
  const hours = Number(sum._sum.hours || 0);
  if (hours === 0) return res.status(400).json({ error: 'No hours logged this month' });

  // Hours and amount are frozen in the payout, so later edits to logs or rates don't change history
  const payout = await prisma.technicianPayout.create({
    data: { technicianId, periodStart: start, periodEnd: end, hours, amount: money(hours * Number(tech.hourlyRate)), paidAt: new Date() },
  });
  res.status(201).json(payout);
});

export default router;
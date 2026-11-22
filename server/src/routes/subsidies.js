import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('ACCOUNTS', 'SALES'));

const STAGES = ['NOT_STARTED', 'DOCUMENTS_COLLECTED', 'SUBMITTED', 'INSPECTION', 'APPROVED', 'DISBURSED'];

router.get('/', async (req, res) => {
  const subsidies = await prisma.subsidy.findMany({
    orderBy: { stageUpdatedAt: 'desc' },
    include: {
      order: { select: { id: true, total: true, customer: { select: { name: true, phone: true } }, kit: { select: { name: true } } } },
    },
  });
  res.json(subsidies);
});

// PATCH /api/subsidies/:id  { advance?: true, scheme?, amount?, notes? }
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const subsidy = await prisma.subsidy.findUnique({ where: { id: Number.isInteger(id) ? id : 0 } });
  if (!subsidy) return res.status(404).json({ error: 'Subsidy not found' });

  const { advance, scheme, amount, notes } = req.body ?? {};
  const data = {};
  if (scheme !== undefined) data.scheme = scheme ? String(scheme).trim() : null;
  if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;
  if (amount !== undefined && amount !== '') {
    const value = Number(amount);
    if (!(value >= 0 && value <= 500000)) return res.status(400).json({ error: 'Enter a valid subsidy amount' });
    data.amount = value;
  }

  if (advance) {
    // Stages only move forward, one at a time
    const index = STAGES.indexOf(subsidy.stage);
    if (index === STAGES.length - 1) return res.status(400).json({ error: 'Subsidy is already disbursed' });
    const next = STAGES[index + 1];
    if (next === 'SUBMITTED' && data.amount === undefined && subsidy.amount === null) {
      return res.status(400).json({ error: 'Enter the subsidy amount before submitting the application' });
    }
    data.stage = next;
    data.stageUpdatedAt = new Date();
  }

  const updated = await prisma.subsidy.update({ where: { id: subsidy.id }, data });
  res.json(updated);
});

export default router;
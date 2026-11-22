import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth, requireRole('DIRECTOR'));

// GET /api/dashboard/summary: all numbers for the director's home page in one call
router.get('/summary', async (req, res) => {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const open = { notIn: ['WON', 'LOST'] };

  const [grouped, newThisWeek, surveysToReview, surveysScheduled, pipeline, recent] = await Promise.all([
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
    prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.survey.count({ where: { status: 'SUBMITTED' } }),
    prisma.survey.count({ where: { status: 'SCHEDULED' } }),
    prisma.lead.aggregate({ where: { status: open }, _sum: { recommendedKw: true } }),
    prisma.lead.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { customer: { select: { name: true, city: true } } },
    }),
  ]);

  res.json({
    byStatus: Object.fromEntries(grouped.map((g) => [g.status, g._count._all])),
    newThisWeek,
    surveysToReview,
    surveysScheduled,
    pipelineKw: pipeline._sum.recommendedKw || 0,
    recent,
  });
});

export default router;
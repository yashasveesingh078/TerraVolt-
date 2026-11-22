import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// Sales needs the technician list to book surveys.
// _count shows how many open surveys each one already has (to spread the work).
router.get('/technicians', requireRole('SALES', 'SERVICE'), async (req, res) => {
  const technicians = await prisma.user.findMany({
    where: { role: 'TECHNICIAN', active: true },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      phone: true,
      _count: { select: { surveys: { where: { status: 'SCHEDULED' } } } },
    },
  });
  res.json(technicians);
});

// Full staff list: director only
router.get('/', requireRole('DIRECTOR'), async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, hourlyRate: true, active: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json(users);
});

export default router;
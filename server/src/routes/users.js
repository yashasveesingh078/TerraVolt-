import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';

const router = Router();

// Every route in this file: must be logged in AND be a director
router.use(requireAuth, requireRole('DIRECTOR'));

// GET /api/users  → list all staff
router.get('/', async (req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, hourlyRate: true, active: true },
    orderBy: [{ role: 'asc' }, { name: 'asc' }],
  });
  res.json(users);
});

export default router;
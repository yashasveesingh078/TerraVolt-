import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// GET /api/notifications → latest 20 + unread count for the logged-in user
router.get('/', async (req, res) => {
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({ where: { userId: req.user.id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.notification.count({ where: { userId: req.user.id, read: false } }),
  ]);
  res.json({ items, unread });
});

router.post('/read-all', async (req, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user.id, read: false }, data: { read: true } });
  res.json({ ok: true });
});

router.post('/:id/read', async (req, res) => {
  // updateMany with userId: you can only mark YOUR OWN notification as read
  await prisma.notification.updateMany({
    where: { id: Number(req.params.id) || 0, userId: req.user.id },
    data: { read: true },
  });
  res.json({ ok: true });
});

export default router;
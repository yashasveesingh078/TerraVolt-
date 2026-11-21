import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

// Cookie settings used for both login and logout
const cookieOptions = {
  httpOnly: true,                                // page JavaScript cannot read it
  sameSite: 'lax',                               // not sent on requests from other websites
  secure: process.env.NODE_ENV === 'production', // HTTPS-only when deployed
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// POST /api/auth/login   body: { email, password }
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
  });

  // Same message for "no such email" and "wrong password" (explained below)
  if (!user || !user.active) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  const passwordOk = await bcrypt.compare(password, user.passwordHash);
  if (!passwordOk) {
    return res.status(401).json({ error: 'Wrong email or password' });
  }

  // Create the signed token (valid for 1 day)
  const token = jwt.sign(
    { id: user.id, role: user.role, name: user.name },
    process.env.JWT_SECRET,
    { expiresIn: '1d' }
  );

  res.cookie('token', token, { ...cookieOptions, maxAge: ONE_DAY_MS });

  // Send back the basic user info (never the passwordHash)
  res.json({ id: user.id, name: user.name, email: user.email, role: user.role });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('token', cookieOptions);
  res.json({ message: 'Logged out' });
});

// GET /api/auth/me  → who is logged in right now?
router.get('/me', requireAuth, async (req, res) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: { id: true, name: true, email: true, role: true },
  });

  if (!user) {
    return res.status(401).json({ error: 'User no longer exists' });
  }

  res.json(user);
});

export default router;
// 1. Load settings from .env into process.env
import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import 'dotenv/config';
import prisma from './db.js';
// 2. Import the libraries we need
import express from 'express';
import cookieParser from 'cookie-parser';

// 3. Create the app
const app = express();

// 4. Middleware: runs on every request, before our routes
app.use(express.json());     // lets us read JSON sent by the frontend (req.body)
app.use(cookieParser());     // lets us read cookies (req.cookies), used for login
app.use('/uploads', express.static('uploads')); // serves uploaded photos as files

// 5. A test route: if this works, the server works
app.get('/api/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
// 6. Error handler: catches any error thrown in a route
//    and sends a clean message instead of crashing.
//    It must be the LAST app.use.
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Server error' });
});

// 7. Start listening for requests
const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`);
});
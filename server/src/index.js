// 1. Load settings from .env into process.env
import authRoutes from './routes/auth.js';
import publicRoutes from './routes/public.js';
import userRoutes from './routes/users.js';
import leadRoutes from './routes/leads.js';
import surveyRoutes from './routes/surveys.js';
import notificationRoutes from './routes/notifications.js';
import dashboardRoutes from './routes/dashboard.js';
import orderRoutes from './routes/orders.js';
import inventoryRoutes from './routes/inventory.js';
import 'dotenv/config';
import prisma from './db.js';
import jobRoutes from './routes/jobs.js';
import ticketRoutes from './routes/tickets.js';
import invoiceRoutes from './routes/invoices.js';
import subsidyRoutes from './routes/subsidies.js';
import payrollRoutes from './routes/payroll.js';
import reportRoutes from './routes/reports.js';
// 2. Import the libraries we need
import express from 'express';
import cookieParser from 'cookie-parser';

// 3. Create the app
const app = express();

// 4. Middleware: runs on every request, before our routes
app.use(express.json());     // lets us read JSON sent by the frontend (req.body)
app.use(cookieParser());     // lets us read cookies (req.cookies), used for login
app.use('/uploads', express.static('uploads')); // serves uploaded photos as files
app.use('/api/public', publicRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/surveys', surveyRoutes);
app.use('/api/notifications', notificationRoutes);
// 5. A test route: if this works, the server works
app.get('/api/health', async (req, res) => {
  await prisma.$queryRaw`SELECT 1`;
  res.json({ status: 'ok', database: 'connected', time: new Date().toISOString() });
});
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/jobs', jobRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/subsidies', subsidyRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/reports', reportRoutes);
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
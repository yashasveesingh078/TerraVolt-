import fs from 'fs/promises';
import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadJobPhotos } from '../middleware/upload.js';
import { notify, notifyRole } from '../services/notify.js';

const router = Router();
router.use(requireAuth);

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}
function addMonths(date, months) {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}
async function discardUploads(req) {
  await Promise.all((req.files || []).map((f) => fs.unlink(f.path).catch(() => {})));
}
const isOnJob = (job, userId) => job.technicians.some((t) => t.id === userId);

const listInclude = {
  technicians: { select: { id: true, name: true } },
  timeLogs: { select: { hours: true } },
  order: {
    select: {
      id: true,
      status: true,
      installAddress: true,
      customer: { select: { name: true, phone: true } },
      kit: { select: { name: true, kw: true, type: true } },
      delivery: { select: { status: true } },
    },
  },
};

// GET /api/jobs/mine → technician's own jobs
router.get('/mine', requireRole('TECHNICIAN'), async (req, res) => {
  const jobs = await prisma.installJob.findMany({
    where: { technicians: { some: { id: req.user.id } } },
    orderBy: [{ status: 'asc' }, { scheduledDate: 'asc' }],
    include: listInclude,
  });
  res.json(jobs);
});

// GET /api/jobs → every job (sales plans them)
router.get('/', requireRole('SALES'), async (req, res) => {
  const jobs = await prisma.installJob.findMany({ orderBy: { createdAt: 'desc' }, take: 200, include: listInclude });
  res.json(jobs);
});

// GET /api/jobs/:id
router.get('/:id', requireRole('SALES', 'TECHNICIAN'), async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid job id' });

  const job = await prisma.installJob.findUnique({
    where: { id },
    include: {
      technicians: { select: { id: true, name: true } },
      timeLogs: { orderBy: { workDate: 'desc' }, include: { technician: { select: { name: true } } } },
      order: {
        include: {
          customer: true,
          kit: { select: { name: true, kw: true, type: true } },
          delivery: true,
          lines: { orderBy: { id: 'asc' }, select: { id: true, description: true, qty: true } },
          serialUnits: {
            orderBy: { serialNo: 'asc' },
            select: { serialNo: true, status: true, warrantyEnd: true, product: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (req.user.role === 'TECHNICIAN' && !isOnJob(job, req.user.id)) {
    return res.status(403).json({ error: 'This job is not assigned to you' });
  }
  res.json(job);
});

// PATCH /api/jobs/:id  { scheduledDate?, technicianIds? } → sales plans the install
router.patch('/:id', requireRole('SALES'), async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid job id' });
  const job = await prisma.installJob.findUnique({ where: { id } });
  if (!job) return res.status(404).json({ error: 'Job not found' });
  if (job.status === 'COMPLETED') return res.status(400).json({ error: 'This job is already completed' });

  const { scheduledDate, technicianIds } = req.body ?? {};
  const data = {};
  if (scheduledDate !== undefined) {
    const date = new Date(scheduledDate);
    if (!scheduledDate || Number.isNaN(date.getTime())) return res.status(400).json({ error: 'Choose a valid date' });
    data.scheduledDate = date;
  }
  if (technicianIds !== undefined) {
    const ids = [...new Set((Array.isArray(technicianIds) ? technicianIds : []).map(Number).filter(Number.isInteger))];
    if (ids.length === 0) return res.status(400).json({ error: 'Pick at least one technician' });
    const found = await prisma.user.count({ where: { id: { in: ids }, role: 'TECHNICIAN', active: true } });
    if (found !== ids.length) return res.status(400).json({ error: 'Unknown technician' });
    data.technicians = { set: ids.map((tid) => ({ id: tid })) }; // replaces the whole team
  }

  const updated = await prisma.installJob.update({ where: { id }, data, include: listInclude });
  const when = updated.scheduledDate ? ` on ${updated.scheduledDate.toLocaleDateString('en-IN')}` : '';
  for (const t of updated.technicians) {
    await notify(prisma, t.id, `Installation for ${updated.order.customer.name} planned${when}`, `/jobs/${id}`);
  }
  res.json(updated);
});

// Loads a job and checks the technician is on it
async function findJobFor(req) {
  const id = readId(req.params.id);
  if (!id) return { status: 400, error: 'Invalid job id' };
  const job = await prisma.installJob.findUnique({
    where: { id },
    include: { technicians: { select: { id: true } }, timeLogs: true, order: { include: { customer: true, lead: true } } },
  });
  if (!job) return { status: 404, error: 'Job not found' };
  if (req.user.role === 'TECHNICIAN' && !isOnJob(job, req.user.id)) {
    return { status: 403, error: 'This job is not assigned to you' };
  }
  return { job };
}

// POST /api/jobs/:id/start
router.post('/:id/start', requireRole('TECHNICIAN'), async (req, res) => {
  const { job, status, error } = await findJobFor(req);
  if (error) return res.status(status).json({ error });
  if (job.status !== 'SCHEDULED') return res.status(400).json({ error: 'This job has already started' });
  if (job.order.status !== 'DISPATCHED') return res.status(400).json({ error: 'The kit has not been dispatched yet' });

  const updated = await prisma.installJob.update({
    where: { id: job.id },
    data: { status: 'IN_PROGRESS', startedAt: new Date() },
  });
  res.json(updated);
});

// POST /api/jobs/:id/time  { hours, workDate } → labour hours (used for job profit and pay)
router.post('/:id/time', requireRole('TECHNICIAN'), async (req, res) => {
  const { job, status, error } = await findJobFor(req);
  if (error) return res.status(status).json({ error });
  if (job.status === 'SCHEDULED') return res.status(400).json({ error: 'Start the job before logging hours' });

  const hours = Number(req.body?.hours);
  if (!(hours > 0 && hours <= 16)) return res.status(400).json({ error: 'Hours must be between 0.5 and 16' });
  const workDate = req.body?.workDate ? new Date(req.body.workDate) : new Date();
  if (Number.isNaN(workDate.getTime()) || workDate > new Date()) {
    return res.status(400).json({ error: 'Work date cannot be in the future' });
  }

  const log = await prisma.timeLog.create({ data: { technicianId: req.user.id, jobId: job.id, hours, workDate } });
  res.status(201).json(log);
});

// POST /api/jobs/:id/complete  (multipart: installedKw, powerTested, signedByName, photos)
router.post('/:id/complete', requireRole('TECHNICIAN'), uploadJobPhotos, async (req, res) => {
  const fail = async (status, error) => {
    await discardUploads(req);
    return res.status(status).json({ error });
  };

  const { job, status, error } = await findJobFor(req);
  if (error) return fail(status, error);
  if (job.status !== 'IN_PROGRESS') return fail(400, 'Start the job first');
  if (job.timeLogs.length === 0) return fail(400, 'Log your hours before completing the job');

  const body = req.body ?? {};
  const installedKw = Number(body.installedKw);
  if (!(installedKw > 0 && installedKw <= 10)) return fail(400, 'Enter the installed capacity in kW');
  if (body.powerTested !== 'true') return fail(400, 'Test the system output before completing');
  const signedByName = String(body.signedByName ?? '').trim();
  if (signedByName.length < 2) return fail(400, "The customer's name is needed as sign-off");
  const photos = (req.files || []).map((f) => `/uploads/jobs/${f.filename}`);
  if (photos.length === 0) return fail(400, 'Add at least one photo of the finished installation');

  const now = new Date();
  const units = await prisma.serialUnit.findMany({
    where: { orderId: job.orderId, status: 'DELIVERED' },
    include: { product: { select: { warrantyMonths: true } } },
  });

  await prisma.$transaction(async (tx) => {
    await tx.installJob.update({
      where: { id: job.id },
      data: { status: 'COMPLETED', finishedAt: now, installedKw, powerTested: true, signedByName, photos },
    });
    await tx.salesOrder.update({ where: { id: job.orderId }, data: { status: 'INSTALLED' } });

    // Warranty runs from the day the system went live on the roof, not the day it left the warehouse
    for (const unit of units) {
      await tx.serialUnit.update({ where: { id: unit.id }, data: { warrantyEnd: addMonths(now, unit.product.warrantyMonths) } });
    }

    const message = `${job.order.customer.name}'s ${installedKw} kW system is installed (order #${job.orderId})`;
    if (job.order.lead?.assignedToId) await notify(tx, job.order.lead.assignedToId, message, `/orders/${job.orderId}`);
    await notifyRole(tx, 'ACCOUNTS', `${message}. Raise the final invoice.`, `/orders/${job.orderId}`);
  });

  res.json({ ok: true });
});

export default router;
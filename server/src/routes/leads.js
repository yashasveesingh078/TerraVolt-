import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { notify } from '../services/notify.js';

const router = Router();
router.use(requireAuth, requireRole('SALES')); // director passes automatically

const STATUSES = ['NEW', 'CONTACTED', 'QUALIFIED', 'SURVEY_REQUESTED', 'SURVEY_APPROVED', 'QUOTED', 'WON', 'LOST'];

// Status changes a salesperson may make by hand.
// SURVEY_REQUESTED / SURVEY_APPROVED / QUOTED / WON are set automatically by later actions.
const MANUAL_MOVES = {
  NEW: ['CONTACTED', 'LOST'],
  CONTACTED: ['QUALIFIED', 'LOST'],
  QUALIFIED: ['CONTACTED', 'LOST'],
  SURVEY_REQUESTED: ['LOST'],
  SURVEY_APPROVED: ['LOST'],
  QUOTED: ['LOST'],
  LOST: ['NEW'],
  WON: [],
};

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// GET /api/leads?status=NEW&q=simran
router.get('/', async (req, res) => {
  const { status, q, mine } = req.query;
  const where = {};
  if (STATUSES.includes(status)) where.status = status;
  if (mine === '1') where.assignedToId = req.user.id;
  if (q && q.trim()) {
    const text = q.trim();
    where.customer = {
      OR: [
        { name: { contains: text, mode: 'insensitive' } },
        { phone: { contains: text } },
        { city: { contains: text, mode: 'insensitive' } },
      ],
    };
  }

  const [leads, grouped] = await Promise.all([
    prisma.lead.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
      include: {
        customer: { select: { name: true, phone: true, city: true } },
        assignedTo: { select: { id: true, name: true } },
        survey: { select: { id: true, status: true } },
      },
    }),
    prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const counts = Object.fromEntries(grouped.map((g) => [g.status, g._count._all]));
  res.json({ leads, counts });
});

// GET /api/leads/:id
router.get('/:id', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid lead id' });

  const lead = await prisma.lead.findUnique({
    where: { id },
    include: {
      customer: true,
      assignedTo: { select: { id: true, name: true } },
      recommendedKit: { select: { id: true, name: true } },
      survey: {
        include: {
          technician: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
        },
      },
      order: { select: { id: true, status: true } },
    },
  });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  res.json(lead);
});

// PATCH /api/leads/:id  { status?, lostReason?, notes?, requestedKw?, wantsSubsidy? }
router.patch('/:id', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid lead id' });

  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const { status, lostReason, notes, requestedKw, wantsSubsidy } = req.body ?? {};
  const data = {};

  if (status !== undefined && status !== lead.status) {
    if (!(MANUAL_MOVES[lead.status] || []).includes(status)) {
      return res.status(400).json({ error: `Cannot move a lead from ${lead.status} to ${status}` });
    }
    if (status === 'LOST') {
      if (!lostReason || String(lostReason).trim().length < 3) {
        return res.status(400).json({ error: 'Give a reason for losing this lead' });
      }
      data.lostReason = String(lostReason).trim();
    }
    if (lead.status === 'LOST') data.lostReason = null; // reopening
    data.status = status;
  }

  if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;

  if (requestedKw !== undefined) {
    if (requestedKw === null || requestedKw === '') {
      data.requestedKw = null;
    } else {
      const kw = Number(requestedKw);
      if (!Number.isInteger(kw) || kw < 1 || kw > 5) {
        return res.status(400).json({ error: 'Requested size must be 1 to 5 kW' });
      }
      data.requestedKw = kw;
    }
  }

  if (wantsSubsidy !== undefined) data.wantsSubsidy = Boolean(wantsSubsidy);

  // A salesperson who works an unassigned lead takes ownership of it
  if (!lead.assignedToId && req.user.role === 'SALES') data.assignedToId = req.user.id;

  const updated = await prisma.lead.update({ where: { id }, data });
  res.json(updated);
});

// POST /api/leads/:id/survey  { technicianId, scheduledDate: "2026-11-23" }
router.post('/:id/survey', async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid lead id' });

  const body = req.body ?? {};
  const technicianId = readId(body.technicianId);
  const scheduledDate = new Date(body.scheduledDate);
  if (!technicianId) return res.status(400).json({ error: 'Choose a technician' });
  if (!body.scheduledDate || Number.isNaN(scheduledDate.getTime())) {
    return res.status(400).json({ error: 'Choose a survey date' });
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (scheduledDate < today) return res.status(400).json({ error: 'Survey date cannot be in the past' });

  const lead = await prisma.lead.findUnique({ where: { id }, include: { survey: true, customer: true } });
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  if (lead.status !== 'QUALIFIED') {
    return res.status(400).json({ error: 'Qualify the lead before booking a survey' });
  }
  if (lead.survey && lead.survey.status !== 'REJECTED') {
    return res.status(400).json({ error: 'This lead already has a survey' });
  }

  const technician = await prisma.user.findFirst({ where: { id: technicianId, role: 'TECHNICIAN', active: true } });
  if (!technician) return res.status(400).json({ error: 'That technician was not found' });

  const survey = await prisma.$transaction(async (tx) => {
    // A lead has at most one survey (leadId is @unique), so a re-visit reuses the rejected row.
    // rejectReason is kept so the technician can see what to fix.
    const saved = lead.survey
      ? await tx.survey.update({
          where: { id: lead.survey.id },
          data: { technicianId, scheduledDate, status: 'SCHEDULED', submittedAt: null, approvedById: null, approvedAt: null },
        })
      : await tx.survey.create({ data: { leadId: id, technicianId, scheduledDate, status: 'SCHEDULED' } });

    await tx.lead.update({
      where: { id },
      data: { status: 'SURVEY_REQUESTED', assignedToId: lead.assignedToId ?? req.user.id },
    });

    await notify(
      tx,
      technicianId,
      `Site survey for ${lead.customer.name} on ${scheduledDate.toLocaleDateString('en-IN')}`,
      `/surveys/${saved.id}`,
    );
    return saved;
  });

  res.status(201).json(survey);
});

export default router;
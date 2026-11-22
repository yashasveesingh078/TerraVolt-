import fs from 'fs/promises';
import { Router } from 'express';
import prisma from '../db.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { uploadSurveyPhotos } from '../middleware/upload.js';
import { notify, notifyRole } from '../services/notify.js';

const router = Router();
router.use(requireAuth);

const ROOF_DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const ROOF_TYPES = ['RCC flat', 'Tin sheet', 'Tiled slope', 'Ground mount'];
const SURVEY_STATUSES = ['SCHEDULED', 'SUBMITTED', 'APPROVED', 'REJECTED'];

function readId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Empty string or missing → NaN, so range checks fail
const num = (v) => (v === undefined || v === null || String(v).trim() === '' ? NaN : Number(v));

function readSurveyInput(body) {
  const tiltDeg = num(body.tiltDeg);
  const cableDistanceM = num(body.cableDistanceM);
  const measuredRoofSqft = Math.round(num(body.measuredRoofSqft));
  const recommendedKw = num(body.recommendedKw);
  const notes = body.notes ? String(body.notes).trim().slice(0, 1000) : null;

  if (!ROOF_DIRECTIONS.includes(body.roofDirection)) return { error: 'Choose the direction the roof faces' };
  if (!ROOF_TYPES.includes(body.roofType)) return { error: 'Choose the roof type' };
  if (!(tiltDeg >= 0 && tiltDeg <= 60)) return { error: 'Tilt must be between 0 and 60 degrees' };
  if (!(cableDistanceM > 0 && cableDistanceM <= 500)) return { error: 'Cable distance must be between 1 and 500 metres' };
  if (!(measuredRoofSqft >= 10 && measuredRoofSqft <= 100000)) return { error: 'Enter the usable roof area in sq ft' };
  if (!(Number.isInteger(recommendedKw) && recommendedKw >= 1 && recommendedKw <= 5)) {
    return { error: 'Recommended size must be 1 to 5 kW' };
  }

  return {
    data: { roofDirection: body.roofDirection, roofType: body.roofType, tiltDeg, cableDistanceM, measuredRoofSqft, recommendedKw, notes },
  };
}

// If a request fails after multer saved photos, delete them again
async function discardUploads(req) {
  await Promise.all((req.files || []).map((f) => fs.unlink(f.path).catch(() => {})));
}

// GET /api/surveys  — technicians see only their own
router.get('/', requireRole('SALES', 'TECHNICIAN'), async (req, res) => {
  const where = {};
  if (req.user.role === 'TECHNICIAN') where.technicianId = req.user.id;
  if (SURVEY_STATUSES.includes(req.query.status)) where.status = req.query.status;

  const surveys = await prisma.survey.findMany({
    where,
    orderBy: { scheduledDate: 'asc' },
    include: {
      lead: { select: { id: true, customer: { select: { name: true, phone: true, address: true, city: true } } } },
      technician: { select: { id: true, name: true } },
    },
  });
  res.json(surveys);
});

// GET /api/surveys/:id
router.get('/:id', requireRole('SALES', 'TECHNICIAN'), async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid survey id' });

  const survey = await prisma.survey.findUnique({
    where: { id },
    include: {
      lead: { include: { customer: true } },
      technician: { select: { id: true, name: true } },
      approvedBy: { select: { id: true, name: true } },
    },
  });
  if (!survey) return res.status(404).json({ error: 'Survey not found' });
  if (req.user.role === 'TECHNICIAN' && survey.technicianId !== req.user.id) {
    return res.status(403).json({ error: 'This survey is not assigned to you' });
  }
  res.json(survey);
});

// POST /api/surveys/:id/submit  (multipart form: fields + photos)
router.post('/:id/submit', requireRole('TECHNICIAN'), uploadSurveyPhotos, async (req, res) => {
  const fail = async (status, error) => {
    await discardUploads(req);
    return res.status(status).json({ error });
  };

  const id = readId(req.params.id);
  if (!id) return fail(400, 'Invalid survey id');

  const survey = await prisma.survey.findUnique({ where: { id }, include: { lead: { include: { customer: true } } } });
  if (!survey) return fail(404, 'Survey not found');
  if (req.user.role === 'TECHNICIAN' && survey.technicianId !== req.user.id) {
    return fail(403, 'This survey is not assigned to you');
  }
  if (survey.status !== 'SCHEDULED') return fail(400, 'Only a scheduled survey can be submitted');

  const input = readSurveyInput(req.body ?? {});
  if (input.error) return fail(400, input.error);

  // New photos replace old ones; on a re-visit with no new photos, keep the earlier ones
  const newPhotos = (req.files || []).map((f) => `/uploads/surveys/${f.filename}`);
  const photos = newPhotos.length > 0 ? newPhotos : survey.photos;
  if (photos.length === 0) return fail(400, 'Add at least one roof photo');

  const lead = survey.lead;
  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.survey.update({
      where: { id },
      data: { ...input.data, photos, status: 'SUBMITTED', submittedAt: new Date() },
    });
    const message = `Survey submitted for ${lead.customer.name}, please review`;
    if (lead.assignedToId) await notify(tx, lead.assignedToId, message, `/leads/${lead.id}`);
    else await notifyRole(tx, 'SALES', message, `/leads/${lead.id}`);
    return saved;
  });

  res.json(updated);
});

// POST /api/surveys/:id/approve
router.post('/:id/approve', requireRole('SALES'), async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid survey id' });

  const survey = await prisma.survey.findUnique({ where: { id }, include: { lead: { include: { customer: true } } } });
  if (!survey) return res.status(404).json({ error: 'Survey not found' });
  if (survey.status !== 'SUBMITTED') return res.status(400).json({ error: 'Only a submitted survey can be approved' });

  const lead = survey.lead;
  if (lead.status !== 'SURVEY_REQUESTED') {
    return res.status(400).json({ error: 'This lead is no longer waiting for a survey' });
  }

  // The technician's measured size becomes the final size; pick the matching kit
  const type = lead.recommendedType || (lead.gridReliability === 'RELIABLE' ? 'ON_GRID' : 'OFF_GRID');
  const kit = await prisma.kit.findUnique({ where: { kw_type: { kw: survey.recommendedKw, type } } });

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.survey.update({
      where: { id },
      data: { status: 'APPROVED', approvedById: req.user.id, approvedAt: new Date(), rejectReason: null },
    });
    await tx.lead.update({
      where: { id: lead.id },
      data: {
        status: 'SURVEY_APPROVED',
        recommendedKw: survey.recommendedKw,
        recommendedType: type,
        recommendedKitId: kit ? kit.id : null,
      },
    });
    await notify(tx, survey.technicianId, `Your survey for ${lead.customer.name} was approved`, `/surveys/${id}`);
    return saved;
  });

  res.json({ survey: updated, kit });
});

// POST /api/surveys/:id/reject  { reason }
router.post('/:id/reject', requireRole('SALES'), async (req, res) => {
  const id = readId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid survey id' });

  const reason = String(req.body?.reason ?? '').trim();
  if (reason.length < 5) return res.status(400).json({ error: 'Explain what needs to be redone (at least 5 characters)' });

  const survey = await prisma.survey.findUnique({ where: { id }, include: { lead: { include: { customer: true } } } });
  if (!survey) return res.status(404).json({ error: 'Survey not found' });
  if (survey.status !== 'SUBMITTED') return res.status(400).json({ error: 'Only a submitted survey can be rejected' });

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.survey.update({ where: { id }, data: { status: 'REJECTED', rejectReason: reason } });
    await tx.lead.update({ where: { id: survey.leadId }, data: { status: 'QUALIFIED' } });
    await notify(
      tx,
      survey.technicianId,
      `Survey for ${survey.lead.customer.name} was sent back: ${reason}`,
      `/surveys/${id}`,
    );
    return saved;
  });

  res.json(updated);
});

export default router;
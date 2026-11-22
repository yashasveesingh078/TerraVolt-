import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, CheckCircle2, ClipboardCheck, FileText, Phone, RotateCcw, XCircle } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import SurveyDetails from '../components/SurveyDetails.jsx';
import { formatDate, formatINR, gridLabel, leadRef, statusLabel, systemTypeLabel } from '../utils/format.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';
const dangerBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-rose-300 px-4 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10';

function Card({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      {title && (
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{title}</h2>
      )}
      {children}
    </section>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className="mt-0.5 text-sm text-slate-800 dark:text-slate-100">{children ?? '—'}</dd>
    </div>
  );
}

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [technicians, setTechnicians] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [notes, setNotes] = useState('');
  const [showLost, setShowLost] = useState(false);
  const [lostReason, setLostReason] = useState('');
  const [booking, setBooking] = useState({ technicianId: '', scheduledDate: '' });
  const [showReject, setShowReject] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const load = useCallback(
    () =>
      api(`/leads/${id}`)
        .then((data) => {
          setLead(data);
          setNotes(data.notes || '');
        })
        .catch((e) => setError(e.message)),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    api('/users/technicians').then(setTechnicians).catch(() => setTechnicians([]));
  }, []);

  // Runs an action, shows any error, then reloads the lead. Returns true on success.
  async function run(action) {
    setBusy(true);
    setError('');
    try {
      await action();
      await load();
      return true;
    } catch (e) {
      setError(e.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  const changeStatus = (status, extra = {}) =>
    run(() => api(`/leads/${id}`, { method: 'PATCH', body: { status, ...extra } }));

  const saveNotes = () => run(() => api(`/leads/${id}`, { method: 'PATCH', body: { notes } }));

  async function markLost(e) {
    e.preventDefault();
    if (await changeStatus('LOST', { lostReason })) {
      setShowLost(false);
      setLostReason('');
    }
  }

  async function bookSurvey(e) {
    e.preventDefault();
    if (await run(() => api(`/leads/${id}/survey`, { method: 'POST', body: booking }))) {
      setBooking({ technicianId: '', scheduledDate: '' });
    }
  }

  const approveSurvey = () => run(() => api(`/surveys/${lead.survey.id}/approve`, { method: 'POST' }));

  async function rejectSurvey(e) {
    e.preventDefault();
    if (await run(() => api(`/surveys/${lead.survey.id}/reject`, { method: 'POST', body: { reason: rejectReason } }))) {
      setShowReject(false);
      setRejectReason('');
    }
  }
    async function createQuote() {
    setBusy(true);
    setError('');
    try {
      const order = await api(`/orders/from-lead/${id}`, { method: 'POST' });
      navigate(`/orders/${order.id}`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  if (!lead) {
    return <div className="p-10 text-center text-slate-500 dark:text-slate-400">{error || 'Loading…'}</div>;
  }

  const survey = lead.survey;
  const canBook = lead.status === 'QUALIFIED' && (!survey || survey.status === 'REJECTED');
  const isClosed = lead.status === 'WON' || lead.status === 'LOST';
  const today = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD in local time

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <Link
          to="/leads"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> All leads
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{lead.customer.name}</h1>
          <StatusBadge status={lead.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {leadRef(lead.id)} · {formatDate(lead.createdAt)} · via {statusLabel(lead.source)} · owner{' '}
          {lead.assignedTo?.name || 'unassigned'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {lead.status === 'SURVEY_APPROVED' && (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
          <p>
            Survey approved. Final size{' '}
            <strong>
              {lead.recommendedKw} kW {systemTypeLabel[lead.recommendedType]}
            </strong>
            {lead.recommendedKit ? ` using kit "${lead.recommendedKit.name}"` : ' (no matching kit, pick one when quoting)'}.
            This lead is ready for a quotation.
          </p>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: information */}
        <div className="space-y-6 lg:col-span-2">
          <Card title="Customer">
            <dl className="grid gap-4 sm:grid-cols-2">
              <Field label="Phone">
                <a
                  href={`tel:${lead.customer.phone}`}
                  className="inline-flex items-center gap-1.5 text-amber-600 hover:underline dark:text-amber-400"
                >
                  <Phone size={14} /> {lead.customer.phone}
                </a>
              </Field>
              <Field label="Email">{lead.customer.email}</Field>
              <Field label="Address">{lead.customer.address}</Field>
              <Field label="City / PIN">
                {[lead.customer.city, lead.customer.pincode].filter(Boolean).join(' – ') || null}
              </Field>
            </dl>
          </Card>

          <Card title="Enquiry and estimate">
            <dl className="grid gap-4 sm:grid-cols-3">
              <Field label="Monthly bill">{lead.monthlyBill != null ? formatINR(lead.monthlyBill) : null}</Field>
              <Field label="Roof area">{lead.roofAreaSqft != null ? `${lead.roofAreaSqft} sq ft` : null}</Field>
              <Field label="Grid">{gridLabel[lead.gridReliability]}</Field>
              <Field label="Suggested size">
                {lead.recommendedKw
                  ? `${lead.recommendedKw} kW ${systemTypeLabel[lead.recommendedType] || ''}`
                  : 'Not feasible from enquiry'}
              </Field>
              <Field label="Kit">{lead.recommendedKit?.name}</Field>
              <Field label="Wants subsidy">{lead.wantsSubsidy ? 'Yes' : 'No'}</Field>
            </dl>
          </Card>

          <Card title="Site survey">
            {!survey ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                No survey booked yet. Qualify the lead, then book a technician visit.
              </p>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700 dark:text-slate-300">
                  <StatusBadge status={survey.status} />
                  <span className="inline-flex items-center gap-1.5">
                    <ClipboardCheck size={15} /> {survey.technician.name}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <CalendarDays size={15} /> {formatDate(survey.scheduledDate)}
                  </span>
                  <Link to={`/surveys/${survey.id}`} className="text-amber-600 hover:underline dark:text-amber-400">
                    Open survey
                  </Link>
                </div>

                {survey.rejectReason && survey.status !== 'APPROVED' && (
                  <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                    Sent back: {survey.rejectReason}
                  </p>
                )}

                {survey.status !== 'SCHEDULED' && <SurveyDetails survey={survey} />}

                {survey.status === 'APPROVED' && survey.approvedBy && (
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Approved by {survey.approvedBy.name} on {formatDate(survey.approvedAt, true)}
                  </p>
                )}

                {survey.status === 'SUBMITTED' && lead.status === 'SURVEY_REQUESTED' && (
                  <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
                    {showReject ? (
                      <form onSubmit={rejectSurvey} className="space-y-3">
                        <textarea
                          rows={2}
                          required
                          className={inputClass}
                          placeholder="What needs to be re-measured or re-photographed?"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                        />
                        <div className="flex gap-2">
                          <button type="submit" disabled={busy} className={dangerBtn}>
                            <XCircle size={16} /> Send back
                          </button>
                          <button type="button" onClick={() => setShowReject(false)} className={secondaryBtn}>
                            Cancel
                          </button>
                        </div>
                      </form>
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        <button onClick={approveSurvey} disabled={busy} className={primaryBtn}>
                          <CheckCircle2 size={16} /> Approve survey
                        </button>
                        <button onClick={() => setShowReject(true)} disabled={busy} className={dangerBtn}>
                          <XCircle size={16} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </Card>
        </div>

        {/* Right: actions */}
        <div className="space-y-6">
          <Card title="Next step">
            <div className="space-y-3">
              {lead.status === 'NEW' && (
                <button onClick={() => changeStatus('CONTACTED')} disabled={busy} className={`${primaryBtn} w-full`}>
                  <Phone size={16} /> Mark as contacted
                </button>
              )}

              {lead.status === 'CONTACTED' && (
                <button onClick={() => changeStatus('QUALIFIED')} disabled={busy} className={`${primaryBtn} w-full`}>
                  <CheckCircle2 size={16} /> Mark as qualified
                </button>
              )}

              {canBook && (
                <form onSubmit={bookSurvey} className="space-y-3">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {survey ? 'Book another survey visit' : 'Book a site survey'}
                  </p>
                  <select
                    required
                    className={inputClass}
                    value={booking.technicianId}
                    onChange={(e) => setBooking({ ...booking, technicianId: e.target.value })}
                  >
                    <option value="">Choose technician…</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t._count.surveys} open)
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    required
                    min={today}
                    className={inputClass}
                    value={booking.scheduledDate}
                    onChange={(e) => setBooking({ ...booking, scheduledDate: e.target.value })}
                  />
                  <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>
                    <CalendarDays size={16} /> Book survey
                  </button>
                </form>
              )}

              {lead.status === 'SURVEY_REQUESTED' && (
                <p className="text-sm text-slate-600 dark:text-slate-400">Waiting for the technician to submit the survey.</p>
              )}

                           {lead.status === 'SURVEY_APPROVED' && !lead.order && (
                <button onClick={createQuote} disabled={busy} className={`${primaryBtn} w-full`}>
                  <FileText size={16} /> Create quotation
                </button>
              )}

              {lead.order && (
                <Link to={`/orders/${lead.order.id}`} className={`${secondaryBtn} w-full`}>
                  <FileText size={16} /> Open quotation #{lead.order.id}
                </Link>
              )}

              {lead.status === 'LOST' && (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Lost: {lead.lostReason}</p>
                  <button onClick={() => changeStatus('NEW')} disabled={busy} className={`${secondaryBtn} w-full`}>
                    <RotateCcw size={16} /> Reopen lead
                  </button>
                </>
              )}

              {!isClosed &&
                (showLost ? (
                  <form onSubmit={markLost} className="space-y-2 border-t border-slate-200 pt-3 dark:border-slate-800">
                    <input
                      required
                      className={inputClass}
                      placeholder="Why? e.g. chose another vendor"
                      value={lostReason}
                      onChange={(e) => setLostReason(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button type="submit" disabled={busy} className={dangerBtn}>
                        Mark lost
                      </button>
                      <button type="button" onClick={() => setShowLost(false)} className={secondaryBtn}>
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : (
                  <button
                    onClick={() => setShowLost(true)}
                    className="w-full text-center text-sm text-rose-600 hover:underline dark:text-rose-400"
                  >
                    Mark as lost
                  </button>
                ))}
            </div>
          </Card>

          <Card title="Notes">
            <textarea
              rows={4}
              className={inputClass}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Call notes, customer preferences…"
            />
            <button
              onClick={saveNotes}
              disabled={busy || notes === (lead.notes || '')}
              className={`${secondaryBtn} mt-3 w-full`}
            >
              Save notes
            </button>
          </Card>
        </div>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, Camera, MapPin, Phone, Send } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import SurveyDetails from '../components/SurveyDetails.jsx';
import { formatDate, formatINR, gridLabel, leadRef } from '../utils/format.js';

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const ROOF_TYPES = ['RCC flat', 'Tin sheet', 'Tiled slope', 'Ground mount'];

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const card = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';

function Label({ text, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">{text}</span>
      {children}
    </label>
  );
}

export default function SurveyForm() {
  const { id } = useParams();
  const { user } = useAuth();
  const [survey, setSurvey] = useState(null);
  const [form, setForm] = useState(null);
  const [files, setFiles] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api(`/surveys/${id}`)
      .then((s) => {
        setSurvey(s);
        // Prefill from an earlier visit (after a rejection) or from the customer's enquiry
        setForm({
          roofDirection: s.roofDirection || 'S',
          roofType: s.roofType || 'RCC flat',
          tiltDeg: s.tiltDeg != null ? String(Number(s.tiltDeg)) : '',
          cableDistanceM: s.cableDistanceM != null ? String(Number(s.cableDistanceM)) : '',
          measuredRoofSqft: s.measuredRoofSqft ?? s.lead.roofAreaSqft ?? '',
          recommendedKw: s.recommendedKw ?? s.lead.recommendedKw ?? '',
          notes: s.notes || '',
        });
      })
      .catch((e) => setError(e.message));
  }, [id]);

  // Small previews of the chosen photos (freed again when the selection changes)
  useEffect(() => {
    const urls = files.map((file) => URL.createObjectURL(file));
    setPreviews(urls);
    return () => urls.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  async function handleSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setError('');

    // FormData = text fields + files in one request (multipart)
    const body = new FormData();
    Object.entries(form).forEach(([key, value]) => body.append(key, value));
    files.forEach((file) => body.append('photos', file));

    try {
      const saved = await api(`/surveys/${id}/submit`, { method: 'POST', body });
      setSurvey({ ...survey, ...saved });
      setFiles([]);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!survey || !form) {
    return <div className="p-10 text-center text-slate-500 dark:text-slate-400">{error || 'Loading…'}</div>;
  }

  const { lead } = survey;
  const isTech = user.role === 'TECHNICIAN';
  const canEdit = survey.status === 'SCHEDULED' && (isTech || user.role === 'DIRECTOR');
  const fullAddress = [lead.customer.address, lead.customer.city, lead.customer.pincode].filter(Boolean).join(', ');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link
          to={isTech ? '/surveys' : `/leads/${lead.id}`}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> {isTech ? 'My surveys' : 'Back to lead'}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Site survey · {lead.customer.name}</h1>
          <StatusBadge status={survey.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {leadRef(lead.id)} · Technician {survey.technician.name}
        </p>
      </div>

      <section className={card}>
        <div className="grid gap-3 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300">
          <p className="flex items-center gap-2">
            <CalendarDays size={16} className="shrink-0 text-slate-400" /> {formatDate(survey.scheduledDate)}
          </p>
          <a href={`tel:${lead.customer.phone}`} className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
            <Phone size={16} className="shrink-0" /> {lead.customer.phone}
          </a>
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress)}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-start gap-2 text-amber-600 sm:col-span-2 dark:text-amber-400"
          >
            <MapPin size={16} className="mt-0.5 shrink-0" /> {fullAddress}
          </a>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-4 dark:border-slate-800">
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Bill / month</p>
            <p className="text-slate-800 dark:text-slate-100">{lead.monthlyBill != null ? formatINR(lead.monthlyBill) : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Roof (customer said)</p>
            <p className="text-slate-800 dark:text-slate-100">{lead.roofAreaSqft ? `${lead.roofAreaSqft} sq ft` : '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Grid</p>
            <p className="text-slate-800 dark:text-slate-100">{gridLabel[lead.gridReliability] || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 dark:text-slate-400">Estimate</p>
            <p className="text-slate-800 dark:text-slate-100">{lead.recommendedKw ? `${lead.recommendedKw} kW` : '—'}</p>
          </div>
        </div>
      </section>

      {survey.rejectReason && survey.status === 'SCHEDULED' && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          Sent back by sales: {survey.rejectReason}
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {canEdit ? (
        <form onSubmit={handleSubmit} className={`${card} space-y-5`}>
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Roof measurements</h2>

          <div className="grid gap-4 sm:grid-cols-2">
            <Label text="Roof faces">
              <select className={inputClass} value={form.roofDirection} onChange={set('roofDirection')}>
                {DIRECTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Label>
            <Label text="Roof type">
              <select className={inputClass} value={form.roofType} onChange={set('roofType')}>
                {ROOF_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
            </Label>
            <Label text="Tilt (degrees)">
              <input type="number" min="0" max="60" step="0.5" required className={inputClass} value={form.tiltDeg} onChange={set('tiltDeg')} />
            </Label>
            <Label text="Cable distance to meter (m)">
              <input type="number" min="1" max="500" step="0.5" required className={inputClass} value={form.cableDistanceM} onChange={set('cableDistanceM')} />
            </Label>
            <Label text="Usable roof area (sq ft)">
              <input type="number" min="10" required className={inputClass} value={form.measuredRoofSqft} onChange={set('measuredRoofSqft')} />
            </Label>
            <Label text="Recommended size">
              <select required className={inputClass} value={form.recommendedKw} onChange={set('recommendedKw')}>
                <option value="">Choose…</option>
                {[1, 2, 3, 4, 5].map((kw) => (
                  <option key={kw} value={kw}>{kw} kW</option>
                ))}
              </select>
            </Label>
          </div>

          <Label text="Notes">
            <textarea rows={3} className={inputClass} value={form.notes} onChange={set('notes')} placeholder="Shade from trees, water tank position, meter location…" />
          </Label>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Roof photos (up to 6)</span>
            <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-6 text-sm text-slate-500 hover:border-amber-500 dark:border-slate-700 dark:text-slate-400">
              <Camera size={24} />
              {files.length ? `${files.length} photo(s) selected, tap to change` : 'Tap to take or choose photos'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                className="hidden"
                onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 6))}
              />
            </label>
            {previews.length > 0 && (
              <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {previews.map((src) => (
                  <img key={src} src={src} alt="" className="aspect-square w-full rounded-lg object-cover" />
                ))}
              </div>
            )}
            {files.length === 0 && survey.photos.length > 0 && (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                {survey.photos.length} photo(s) from the earlier visit will be kept unless you add new ones.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50 sm:w-auto"
          >
            <Send size={16} /> {busy ? 'Submitting…' : 'Submit survey'}
          </button>
        </form>
      ) : survey.status === 'SCHEDULED' ? (
        <p className={`${card} text-sm text-slate-500 dark:text-slate-400`}>Waiting for the technician to visit and submit.</p>
      ) : (
        <section className={card}>
          <SurveyDetails survey={survey} />
        </section>
      )}
    </div>
  );
}
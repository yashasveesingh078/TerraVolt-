import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, CheckCircle2, Clock, MapPin, Phone, Play } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, statusLabel } from '../utils/format.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const card = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
const cardTitle = 'mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50';

export default function JobDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const isTech = user.role === 'TECHNICIAN';
  const canAct = isTech || user.role === 'DIRECTOR';
  const today = new Date().toLocaleDateString('en-CA');

  const [job, setJob] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [technicians, setTechnicians] = useState([]);
  const [plan, setPlan] = useState({ scheduledDate: '', technicianIds: [] });
  const [time, setTime] = useState({ hours: '', workDate: today });
  const [finish, setFinish] = useState({ installedKw: '', powerTested: false, signedByName: '' });
  const [files, setFiles] = useState([]);

  const load = useCallback(
    () =>
      api(`/jobs/${id}`)
        .then((j) => {
          setJob(j);
          setPlan({
            scheduledDate: j.scheduledDate ? j.scheduledDate.slice(0, 10) : '',
            technicianIds: j.technicians.map((t) => t.id),
          });
          setFinish((f) => ({ ...f, installedKw: f.installedKw || String(j.order.kit?.kw ?? '') }));
        })
        .catch((e) => setError(e.message)),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!isTech) api('/users/technicians').then(setTechnicians).catch(() => {});
  }, [isTech]);

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

  const savePlan = (e) => {
    e.preventDefault();
    run(() => api(`/jobs/${id}`, { method: 'PATCH', body: plan }));
  };
  const startJob = () => run(() => api(`/jobs/${id}/start`, { method: 'POST' }));

  async function logTime(e) {
    e.preventDefault();
    if (await run(() => api(`/jobs/${id}/time`, { method: 'POST', body: time }))) setTime({ ...time, hours: '' });
  }

  async function completeJob(e) {
    e.preventDefault();
    const body = new FormData();
    body.append('installedKw', finish.installedKw);
    body.append('powerTested', String(finish.powerTested));
    body.append('signedByName', finish.signedByName);
    files.forEach((file) => body.append('photos', file));
    if (await run(() => api(`/jobs/${id}/complete`, { method: 'POST', body }))) setFiles([]);
  }

  const toggleTech = (tid) =>
    setPlan((p) => ({
      ...p,
      technicianIds: p.technicianIds.includes(tid) ? p.technicianIds.filter((x) => x !== tid) : [...p.technicianIds, tid],
    }));

  if (!job) return <div className="p-10 text-center text-slate-500 dark:text-slate-400">{error || 'Loading…'}</div>;

  const { order } = job;
  const totalHours = job.timeLogs.reduce((sum, l) => sum + Number(l.hours), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div>
        <Link
          to={isTech ? '/my-jobs' : '/jobs'}
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> {isTech ? 'My jobs' : 'Installation jobs'}
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Installation · {order.customer.name}</h1>
          <StatusBadge status={job.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Order #{order.id} · {order.kit?.name} · kit {statusLabel(order.delivery?.status || 'PENDING').toLowerCase()}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <section className={`${card} grid gap-2 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300`}>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.installAddress || '')}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-start gap-2 text-amber-600 dark:text-amber-400"
        >
          <MapPin size={16} className="mt-0.5 shrink-0" /> {order.installAddress}
        </a>
        <a href={`tel:${order.customer.phone}`} className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <Phone size={16} className="shrink-0" /> {order.customer.phone}
        </a>
        <p>Date: {job.scheduledDate ? formatDate(job.scheduledDate) : 'not set'}</p>
        <p>Team: {job.technicians.map((t) => t.name).join(', ') || 'none yet'}</p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Sales: plan the job */}
        {!isTech && job.status !== 'COMPLETED' && (
          <form onSubmit={savePlan} className={`${card} space-y-3`}>
            <h2 className={cardTitle}>Plan installation</h2>
            <input
              type="date"
              required
              min={today}
              className={inputClass}
              value={plan.scheduledDate}
              onChange={(e) => setPlan({ ...plan, scheduledDate: e.target.value })}
            />
            <div className="grid grid-cols-2 gap-2">
              {technicians.map((t) => (
                <label key={t.id} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                  <input type="checkbox" checked={plan.technicianIds.includes(t.id)} onChange={() => toggleTech(t.id)} />
                  {t.name}
                </label>
              ))}
            </div>
            <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>
              Save plan
            </button>
          </form>
        )}

        {/* Technician: start */}
        {canAct && job.status === 'SCHEDULED' && (
          <section className={card}>
            <h2 className={cardTitle}>Start</h2>
            {order.status === 'DISPATCHED' ? (
              <button onClick={startJob} disabled={busy} className={`${primaryBtn} w-full py-3`}>
                <Play size={18} /> Start installation
              </button>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Waiting for the warehouse to dispatch the kit.</p>
            )}
          </section>
        )}

        {/* Technician: log hours + complete */}
        {canAct && job.status === 'IN_PROGRESS' && (
          <>
            <form onSubmit={logTime} className={`${card} space-y-3`}>
              <h2 className={cardTitle}>Log hours</h2>
              <div className="grid grid-cols-2 gap-3">
                <input
                  type="number"
                  step="0.5"
                  min="0.5"
                  max="16"
                  required
                  placeholder="Hours"
                  className={inputClass}
                  value={time.hours}
                  onChange={(e) => setTime({ ...time, hours: e.target.value })}
                />
                <input
                  type="date"
                  max={today}
                  required
                  className={inputClass}
                  value={time.workDate}
                  onChange={(e) => setTime({ ...time, workDate: e.target.value })}
                />
              </div>
              <button type="submit" disabled={busy} className={`${primaryBtn} w-full`}>
                <Clock size={16} /> Add hours
              </button>
            </form>

            <form onSubmit={completeJob} className={`${card} space-y-3 lg:col-span-2`}>
              <h2 className={cardTitle}>Complete installation</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="text-sm text-slate-700 dark:text-slate-300">
                  Installed capacity (kW)
                  <input
                    type="number"
                    step="0.01"
                    min="0.1"
                    required
                    className={`${inputClass} mt-1`}
                    value={finish.installedKw}
                    onChange={(e) => setFinish({ ...finish, installedKw: e.target.value })}
                  />
                </label>
                <label className="text-sm text-slate-700 dark:text-slate-300">
                  Customer name (sign-off)
                  <input
                    required
                    className={`${inputClass} mt-1`}
                    value={finish.signedByName}
                    onChange={(e) => setFinish({ ...finish, signedByName: e.target.value })}
                  />
                </label>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                <input
                  type="checkbox"
                  checked={finish.powerTested}
                  onChange={(e) => setFinish({ ...finish, powerTested: e.target.checked })}
                />
                System output tested and working
              </label>
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border-2 border-dashed border-slate-300 p-5 text-sm text-slate-500 hover:border-amber-500 dark:border-slate-700 dark:text-slate-400">
                <Camera size={20} />
                {files.length ? `${files.length} photo(s) selected` : 'Add photos of the finished installation'}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  multiple
                  className="hidden"
                  onChange={(e) => setFiles(Array.from(e.target.files || []).slice(0, 6))}
                />
              </label>
              <button type="submit" disabled={busy || !finish.powerTested} className={`${primaryBtn} w-full py-3`}>
                <CheckCircle2 size={18} /> {busy ? 'Saving…' : 'Mark as installed'}
              </button>
            </form>
          </>
        )}

        {job.status === 'COMPLETED' && (
          <section className={`${card} lg:col-span-2`}>
            <p className="mb-3 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 size={18} /> Installed {formatDate(job.finishedAt, true)} · {Number(job.installedKw)} kW · signed by{' '}
              {job.signedByName}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {job.photos.map((src) => (
                <a key={src} href={src} target="_blank" rel="noreferrer">
                  <img src={src} alt="Installation" className="aspect-square w-full rounded-lg object-cover" />
                </a>
              ))}
            </div>
          </section>
        )}

        <section className={card}>
          <h2 className={cardTitle}>Hours · {totalHours} h</h2>
          {job.timeLogs.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No hours logged yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
              {job.timeLogs.map((l) => (
                <li key={l.id} className="flex justify-between py-2 text-slate-700 dark:text-slate-300">
                  <span>
                    {l.technician.name} · {formatDate(l.workDate)}
                  </span>
                  <span className="font-medium">{Number(l.hours)} h</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={card}>
          <h2 className={cardTitle}>Equipment on this roof</h2>
          <ul className="space-y-1.5 text-sm">
            {order.serialUnits.map((u) => (
              <li key={u.serialNo} className="flex justify-between gap-3 text-slate-700 dark:text-slate-300">
                <span>
                  <span className="font-mono">{u.serialNo}</span> · {u.product.name}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {u.warrantyEnd ? `to ${formatDate(u.warrantyEnd)}` : statusLabel(u.status)}
                </span>
              </li>
            ))}
            {order.serialUnits.length === 0 && (
              <li className="text-slate-500 dark:text-slate-400">Serials appear once the kit is dispatched.</li>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
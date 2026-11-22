import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Clock, MapPin, Truck, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, statusLabel } from '../utils/format.js';

export default function Jobs() {
  const { user } = useAuth();
  const isTech = user.role === 'TECHNICIAN';
  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api(isTech ? '/jobs/mine' : '/jobs')
      .then(setJobs)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [isTech]);

  const hours = (job) => job.timeLogs.reduce((sum, l) => sum + Number(l.hours), 0);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isTech ? 'My jobs' : 'Installation jobs'}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isTech ? 'Installations you are part of.' : 'Plan dates and teams for every confirmed order.'}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="p-10 text-center text-slate-500 dark:text-slate-400">Loading…</p>
      ) : jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No installation jobs yet.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <Link
              key={job.id}
              to={`/jobs/${job.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500/60"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{job.order.customer.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Order #{job.order.id} · {job.order.kit?.name}
                  </p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                <p className="flex items-center gap-2">
                  <CalendarDays size={15} className="shrink-0" />
                  {job.scheduledDate ? formatDate(job.scheduledDate) : 'Date not set'}
                </p>
                <p className="flex items-start gap-2">
                  <MapPin size={15} className="mt-0.5 shrink-0" /> {job.order.installAddress}
                </p>
                <p className="flex items-center gap-2">
                  <Truck size={15} className="shrink-0" /> Kit {statusLabel(job.order.delivery?.status || 'PENDING').toLowerCase()}
                </p>
                <p className="flex items-center gap-2">
                  <Users size={15} className="shrink-0" /> {job.technicians.map((t) => t.name).join(', ') || 'No team yet'}
                </p>
                {hours(job) > 0 && (
                  <p className="flex items-center gap-2">
                    <Clock size={15} className="shrink-0" /> {hours(job)} h logged
                  </p>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
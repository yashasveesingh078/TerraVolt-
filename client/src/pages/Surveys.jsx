import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MapPin, Phone, User } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, statusLabel } from '../utils/format.js';

const TABS = ['ALL', 'SCHEDULED', 'SUBMITTED', 'APPROVED', 'REJECTED'];

export default function Surveys() {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState([]);
  const [tab, setTab] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/surveys')
      .then(setSurveys)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const isTech = user.role === 'TECHNICIAN';
  const shown = tab === 'ALL' ? surveys : surveys.filter((s) => s.status === tab);

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">{isTech ? 'My site surveys' : 'Site surveys'}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {isTech ? 'Visits assigned to you. Open one to fill in the roof details.' : 'Every survey booked by the sales team.'}
        </p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === t
                ? 'bg-amber-500 text-slate-900'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t === 'ALL' ? 'All' : statusLabel(t)}
            <span className="ml-1.5 opacity-70">
              {t === 'ALL' ? surveys.length : surveys.filter((s) => s.status === t).length}
            </span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="p-10 text-center text-slate-500 dark:text-slate-400">Loading…</p>
      ) : shown.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No surveys here.
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((s) => (
            <Link
              key={s.id}
              to={`/surveys/${s.id}`}
              className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500/60"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="font-semibold text-slate-800 dark:text-slate-100">{s.lead.customer.name}</span>
                <StatusBadge status={s.status} />
              </div>
              <div className="mt-3 space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
                <p className="flex items-center gap-2">
                  <CalendarDays size={15} className="shrink-0" /> {formatDate(s.scheduledDate)}
                </p>
                <p className="flex items-center gap-2">
                  <MapPin size={15} className="shrink-0" /> {s.lead.customer.address}
                  {s.lead.customer.city ? `, ${s.lead.customer.city}` : ''}
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={15} className="shrink-0" /> {s.lead.customer.phone}
                </p>
                {!isTech && (
                  <p className="flex items-center gap-2">
                    <User size={15} className="shrink-0" /> {s.technician.name}
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
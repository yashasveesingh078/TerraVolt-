import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardCheck, Sun, TrendingUp, Users } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, leadRef, statusLabel } from '../utils/format.js';

const FUNNEL = ['NEW', 'CONTACTED', 'QUALIFIED', 'SURVEY_REQUESTED', 'SURVEY_APPROVED', 'QUOTED', 'WON'];
const card = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';

function Stat({ icon: Icon, label, value, hint, to }) {
  const body = (
    <div className={`${card} h-full ${to ? 'hover:border-amber-400 dark:hover:border-amber-500/60' : ''}`}>
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Icon size={16} /> {label}
      </div>
      <p className="mt-2 text-3xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
      {hint && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{hint}</p>}
    </div>
  );
  return to ? <Link to={to}>{body}</Link> : body;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/dashboard/summary').then(setData).catch((e) => setError(e.message));
  }, []);

  if (!data) {
    return <div className="p-10 text-center text-slate-500 dark:text-slate-400">{error || 'Loading…'}</div>;
  }

  const { byStatus } = data;
  const openLeads = FUNNEL.slice(0, 6).reduce((sum, s) => sum + (byStatus[s] || 0), 0);
  const maxCount = Math.max(1, ...FUNNEL.map((s) => byStatus[s] || 0));

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Welcome, {user.name}</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Where every customer is right now.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat icon={Users} label="Open leads" value={openLeads} hint={`${data.newThisWeek} new this week`} to="/leads" />
        <Stat icon={ClipboardCheck} label="Surveys to review" value={data.surveysToReview} hint={`${data.surveysScheduled} visits scheduled`} to="/surveys" />
        <Stat icon={Sun} label="Pipeline size" value={`${data.pipelineKw} kW`} hint="Suggested size of all open leads" />
        <Stat icon={TrendingUp} label="Won / lost" value={`${byStatus.WON || 0} / ${byStatus.LOST || 0}`} hint="All time" />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <section className={`${card} lg:col-span-3`}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Sales funnel</h2>
          <div className="space-y-3">
            {FUNNEL.map((status) => {
              const count = byStatus[status] || 0;
              return (
                <div key={status} className="flex items-center gap-3">
                  <span className="w-36 shrink-0 text-sm text-slate-600 dark:text-slate-300">{statusLabel(status)}</span>
                  <div className="h-6 flex-1 rounded bg-slate-100 dark:bg-slate-800">
                    <div
                      className="h-6 rounded bg-amber-500 transition-all"
                      style={{ width: `${(count / maxCount) * 100}%`, minWidth: count ? '1.5rem' : 0 }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-semibold text-slate-800 dark:text-slate-100">{count}</span>
                </div>
              );
            })}
          </div>
        </section>

        <section className={`${card} lg:col-span-2`}>
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Latest enquiries</h2>
          {data.recent.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No enquiries yet.</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {data.recent.map((lead) => (
                <li key={lead.id}>
                  <Link to={`/leads/${lead.id}`} className="flex items-center justify-between gap-3 py-2.5 hover:opacity-80">
                    <div>
                      <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{lead.customer.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {leadRef(lead.id)} · {lead.customer.city || '—'} · {formatDate(lead.createdAt)}
                      </p>
                    </div>
                    <StatusBadge status={lead.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatINR, leadRef, statusLabel, systemTypeLabel } from '../utils/format.js';

const TABS = ['ALL', 'NEW', 'CONTACTED', 'QUALIFIED', 'SURVEY_REQUESTED', 'SURVEY_APPROVED', 'QUOTED', 'WON', 'LOST'];

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const th = 'px-4 py-3 font-medium';
const td = 'px-4 py-3';

export default function Leads() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('ALL');
  const [search, setSearch] = useState('');
  const [data, setData] = useState({ leads: [], counts: {} });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const params = new URLSearchParams();
    if (status !== 'ALL') params.set('status', status);
    if (search.trim()) params.set('q', search.trim());

    // Wait 300 ms after the last keystroke before searching
    const timer = setTimeout(() => {
      setLoading(true);
      api(`/leads?${params}`)
        .then((d) => {
          setData(d);
          setError('');
        })
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [status, search]);

  const total = Object.values(data.counts).reduce((sum, n) => sum + n, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Leads</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Every enquiry from the website, calls and walk-ins.</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, phone or city"
            className={`${inputClass} pl-9`}
          />
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const count = tab === 'ALL' ? total : data.counts[tab] || 0;
          const active = status === tab;
          return (
            <button
              key={tab}
              onClick={() => setStatus(tab)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
                active
                  ? 'bg-amber-500 text-slate-900'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
              }`}
            >
              {tab === 'ALL' ? 'All' : statusLabel(tab)}
              <span className="ml-1.5 opacity-70">{count}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Lead</th>
              <th className={th}>Customer</th>
              <th className={th}>City</th>
              <th className={th}>Bill / month</th>
              <th className={th}>Suggested</th>
              <th className={th}>Status</th>
              <th className={th}>Assigned</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading && data.leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">Loading…</td>
              </tr>
            ) : data.leads.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">No leads here yet.</td>
              </tr>
            ) : (
              data.leads.map((lead) => (
                <tr
                  key={lead.id}
                  onClick={() => navigate(`/leads/${lead.id}`)}
                  className="cursor-pointer text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <td className={td}>
                    <div className="font-medium text-slate-800 dark:text-slate-100">{leadRef(lead.id)}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(lead.createdAt)}</div>
                  </td>
                  <td className={td}>
                    <div className="font-medium text-slate-800 dark:text-slate-100">{lead.customer.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{lead.customer.phone}</div>
                  </td>
                  <td className={td}>{lead.customer.city || '—'}</td>
                  <td className={td}>{lead.monthlyBill != null ? formatINR(lead.monthlyBill) : '—'}</td>
                  <td className={td}>
                    {lead.recommendedKw ? `${lead.recommendedKw} kW ${systemTypeLabel[lead.recommendedType] || ''}` : 'Not feasible'}
                  </td>
                  <td className={td}><StatusBadge status={lead.status} /></td>
                  <td className={td}>{lead.assignedTo?.name || 'Unassigned'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
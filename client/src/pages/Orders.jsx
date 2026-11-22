import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatINR, statusLabel, systemTypeLabel } from '../utils/format.js';

const TABS = ['ALL', 'QUOTE', 'ACCEPTED', 'CONFIRMED', 'DISPATCHED', 'INSTALLED', 'CLOSED'];
const th = 'px-4 py-3 font-medium';
const td = 'px-4 py-3';

export default function Orders() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState([]);
  const [tab, setTab] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api('/orders')
      .then(setOrders)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const shown = tab === 'ALL' ? orders : orders.filter((o) => o.status === tab);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Quotes & orders</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">From quotation to confirmed order.</p>
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
            <span className="ml-1.5 opacity-70">{t === 'ALL' ? orders.length : orders.filter((o) => o.status === t).length}</span>
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Order</th>
              <th className={th}>Customer</th>
              <th className={th}>System</th>
              <th className={`${th} text-right`}>Total</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">No orders here yet.</td></tr>
            ) : (
              shown.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => navigate(`/orders/${o.id}`)}
                  className="cursor-pointer text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800/60"
                >
                  <td className={td}>
                    <div className="font-medium text-slate-800 dark:text-slate-100">#{o.id}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(o.createdAt)}</div>
                  </td>
                  <td className={td}>
                    <div className="font-medium text-slate-800 dark:text-slate-100">{o.customer.name}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{o.customer.city || o.customer.phone}</div>
                  </td>
                  <td className={td}>{o.kit ? `${o.kit.kw} kW ${systemTypeLabel[o.kit.type]}` : '—'}</td>
                  <td className={`${td} text-right font-medium`}>{formatINR(o.total)}</td>
                  <td className={td}><StatusBadge status={o.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
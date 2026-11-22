import { Fragment, useCallback, useEffect, useState } from 'react';
import { FilePlus2, Wallet } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatINR, statusLabel } from '../utils/format.js';

const METHODS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];
const TABS = [
  { key: 'OPEN', label: 'Unpaid' },
  { key: 'PAID', label: 'Paid' },
  { key: 'ALL', label: 'All' },
];
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const th = 'px-4 py-3 font-medium';
const td = 'px-4 py-3';

export default function Invoices() {
  const [tab, setTab] = useState('OPEN');
  const [invoices, setInvoices] = useState([]);
  const [ready, setReady] = useState([]);
  const [paying, setPaying] = useState(null);
  const [payment, setPayment] = useState({ amount: '', method: 'UPI', reference: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      Promise.all([api('/invoices').then(setInvoices), api('/invoices/ready').then(setReady)])
        .catch((e) => setError(e.message))
        .finally(() => setLoading(false)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

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

  const raiseFinal = (orderId) => run(() => api(`/invoices/final/${orderId}`, { method: 'POST' }));

  async function recordPayment(e) {
    e.preventDefault();
    if (await run(() => api(`/invoices/${paying.id}/payments`, { method: 'POST', body: payment }))) setPaying(null);
  }

  const shown = invoices.filter((i) => tab === 'ALL' || (tab === 'PAID' ? i.status === 'PAID' : i.status !== 'PAID'));
  const outstanding = invoices.filter((i) => i.status !== 'PAID').reduce((s, i) => s + i.balance, 0);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Invoices</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Advance, final and repair invoices with payments.</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-right dark:border-slate-800 dark:bg-slate-900">
          <p className="text-xs text-slate-500 dark:text-slate-400">Outstanding</p>
          <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{formatINR(outstanding)}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {ready.length > 0 && (
        <section className="space-y-3 rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
          <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Installed, ready for final invoice</p>
          {ready.map((o) => (
            <div
              key={o.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3 text-sm dark:bg-slate-900"
            >
              <span className="text-slate-700 dark:text-slate-300">
                <strong className="text-slate-800 dark:text-slate-100">{o.customer.name}</strong> · order #{o.id} · {o.kit?.name}{' '}
                · total {formatINR(o.total)} − advance {formatINR(o.advance)}
              </span>
              <button
                onClick={() => raiseFinal(o.id)}
                disabled={busy}
                className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-3 py-1.5 font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
              >
                <FilePlus2 size={15} /> Invoice {formatINR(o.due)}
              </button>
            </div>
          ))}
        </section>
      )}

      <div className="flex gap-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === t.key
                ? 'bg-amber-500 text-slate-900'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Invoice</th>
              <th className={th}>Customer</th>
              <th className={th}>Type</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={`${th} text-right`}>Balance</th>
              <th className={th}>Status</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
            {loading ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">No invoices here.</td></tr>
            ) : (
              shown.map((inv) => (
                <Fragment key={inv.id}>
                  <tr>
                    <td className={td}>
                      <div className="font-medium text-slate-800 dark:text-slate-100">{inv.number}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(inv.issueDate)}
                        {inv.dueDate && inv.status !== 'PAID' ? ` · due ${formatDate(inv.dueDate)}` : ''}
                      </div>
                    </td>
                    <td className={td}>{inv.customer.name}</td>
                    <td className={td}>{statusLabel(inv.type)}</td>
                    <td className={`${td} text-right`}>{formatINR(inv.amount)}</td>
                    <td className={`${td} text-right font-medium`}>{formatINR(inv.balance)}</td>
                    <td className={td}><StatusBadge status={inv.status} /></td>
                    <td className={`${td} text-right`}>
                      {inv.status !== 'PAID' && (
                        <button
                          onClick={() => {
                            setPaying(paying?.id === inv.id ? null : inv);
                            setPayment({ amount: String(inv.balance), method: 'UPI', reference: '' });
                          }}
                          className="text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
                        >
                          Record payment
                        </button>
                      )}
                    </td>
                  </tr>
                  {paying?.id === inv.id && (
                    <tr>
                      <td colSpan={7} className="bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
                        <form onSubmit={recordPayment} className="grid gap-2 sm:grid-cols-4">
                          <input
                            type="number"
                            min="1"
                            required
                            className={inputClass}
                            value={payment.amount}
                            onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                          />
                          <select
                            className={inputClass}
                            value={payment.method}
                            onChange={(e) => setPayment({ ...payment, method: e.target.value })}
                          >
                            {METHODS.map((m) => (
                              <option key={m} value={m}>{statusLabel(m)}</option>
                            ))}
                          </select>
                          <input
                            className={inputClass}
                            placeholder="Reference"
                            value={payment.reference}
                            onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
                          />
                          <button
                            type="submit"
                            disabled={busy}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                          >
                            <Wallet size={15} /> Save payment
                          </button>
                        </form>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
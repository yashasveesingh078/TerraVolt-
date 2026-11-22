import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { api } from '../api.js';
import { formatDate, formatINR } from '../utils/format.js';

const th = 'px-4 py-3 font-medium';
const td = 'px-4 py-3';

export default function Payroll() {
  const [month, setMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [rows, setRows] = useState([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api(`/payroll?month=${month}`)
        .then((d) => {
          setRows(d.rows);
          setError('');
        })
        .catch((e) => setError(e.message)),
    [month],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function pay(technicianId) {
    setBusy(true);
    setError('');
    try {
      await api('/payroll/pay', { method: 'POST', body: { technicianId, month } });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const total = rows.reduce((s, r) => s + r.amount, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Technician pay</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">From hours logged on installations and repairs.</p>
        </div>
        <input
          type="month"
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Technician</th>
              <th className={`${th} text-right`}>Hours</th>
              <th className={`${th} text-right`}>Rate</th>
              <th className={`${th} text-right`}>Amount</th>
              <th className={th}></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
            {rows.map((r) => (
              <tr key={r.technicianId}>
                <td className={`${td} font-medium text-slate-800 dark:text-slate-100`}>{r.name}</td>
                <td className={`${td} text-right`}>{r.hours}</td>
                <td className={`${td} text-right`}>{formatINR(r.rate)}/h</td>
                <td className={`${td} text-right font-semibold`}>{formatINR(r.amount)}</td>
                <td className={`${td} text-right`}>
                  {r.paidAt ? (
                    <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 size={14} /> Paid {formatDate(r.paidAt)}
                    </span>
                  ) : r.hours > 0 ? (
                    <button
                      onClick={() => pay(r.technicianId)}
                      disabled={busy}
                      className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                    >
                      Mark paid
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">No hours</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t border-slate-200 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
            <tr>
              <td className={td} colSpan={3}>Total</td>
              <td className={`${td} text-right`}>{formatINR(total)}</td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
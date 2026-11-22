import { useEffect, useState } from 'react';
import { Banknote, ClipboardList, HardHat, LifeBuoy, ReceiptText, ShieldAlert, ShoppingCart, Users } from 'lucide-react';
import { api } from '../api.js';
import { formatDate, formatINR } from '../utils/format.js';

const card = 'rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900';
const th = 'px-4 py-3 font-medium text-right';
const td = 'px-4 py-3 text-right';

function Kpi({ icon: Icon, label, value }) {
  return (
    <div className={card}>
      <p className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
        <Icon size={15} /> {label}
      </p>
      <p className="mt-1.5 text-xl font-bold text-slate-800 dark:text-slate-100">{value}</p>
    </div>
  );
}

export default function MonthlyReport() {
  const [month, setMonth] = useState(new Date().toLocaleDateString('en-CA').slice(0, 7));
  const [report, setReport] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setReport(null);
    api(`/reports/monthly?month=${month}`)
      .then((r) => {
        setReport(r);
        setError('');
      })
      .catch((e) => setError(e.message));
  }, [month]);

  const t = report?.totals;
  const totalMargin = t && t.revenue > 0 ? ((t.profit / t.revenue) * 100).toFixed(1) : '0.0';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Monthly report</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">What came in, what went out, and what each job really earned.</p>
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

      {!report ? (
        !error && <p className="p-10 text-center text-slate-500 dark:text-slate-400">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi icon={Users} label="New leads" value={report.newLeads} />
            <Kpi icon={ShoppingCart} label="Orders confirmed" value={report.confirmedOrders} />
            <Kpi icon={HardHat} label="Installations" value={report.installs} />
            <Kpi icon={LifeBuoy} label="Service tickets" value={report.ticketsOpened} />
            <Kpi icon={ReceiptText} label="Invoiced" value={formatINR(report.invoiced)} />
            <Kpi icon={Banknote} label="Cash collected" value={formatINR(report.collected)} />
            <Kpi icon={ShieldAlert} label="Warranty repair cost" value={formatINR(report.warrantyCostThisMonth)} />
            <Kpi icon={ClipboardList} label="Job profit" value={`${formatINR(t.profit)} (${totalMargin}%)`} />
          </div>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Profit per installation</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Sale (ex GST) − materials − labour − warranty repairs on that roof (to date)
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Job</th>
                    <th className={th}>Sale</th>
                    <th className={th}>Materials</th>
                    <th className={th}>Labour</th>
                    <th className={th}>Warranty</th>
                    <th className={th}>Profit</th>
                    <th className={th}>Margin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                  {report.jobs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">
                        No installations completed this month.
                      </td>
                    </tr>
                  ) : (
                    report.jobs.map((j) => (
                      <tr key={j.jobId}>
                        <td className="px-4 py-3 text-left">
                          <div className="font-medium text-slate-800 dark:text-slate-100">{j.customer}</div>
                          <div className="text-xs text-slate-500 dark:text-slate-400">
                            Order #{j.orderId} · {j.kit} · {formatDate(j.finishedAt)}
                          </div>
                        </td>
                        <td className={td}>{formatINR(j.revenue)}</td>
                        <td className={td}>−{formatINR(j.materials)}</td>
                        <td className={td}>−{formatINR(j.labour)}</td>
                        <td className={`${td} ${j.warranty > 0 ? 'font-semibold text-rose-600 dark:text-rose-400' : ''}`}>
                          −{formatINR(j.warranty)}
                        </td>
                        <td
                          className={`${td} font-semibold ${
                            j.profit < 0 ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'
                          }`}
                        >
                          {formatINR(j.profit)}
                        </td>
                        <td className={td}>{j.margin}%</td>
                      </tr>
                    ))
                  )}
                </tbody>
                {report.jobs.length > 0 && (
                  <tfoot className="border-t border-slate-200 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                    <tr>
                      <td className="px-4 py-3 text-left">Total</td>
                      <td className={td}>{formatINR(t.revenue)}</td>
                      <td className={td}>−{formatINR(t.materials)}</td>
                      <td className={td}>−{formatINR(t.labour)}</td>
                      <td className={td}>−{formatINR(t.warranty)}</td>
                      <td className={td}>{formatINR(t.profit)}</td>
                      <td className={td}>{totalMargin}%</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
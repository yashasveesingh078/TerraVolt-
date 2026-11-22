import { useCallback, useEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { api } from '../api.js';
import { formatDate, formatINR, statusLabel } from '../utils/format.js';

const STAGES = ['NOT_STARTED', 'DOCUMENTS_COLLECTED', 'SUBMITTED', 'INSPECTION', 'APPROVED', 'DISBURSED'];

export default function Subsidies() {
  const [subsidies, setSubsidies] = useState([]);
  const [amounts, setAmounts] = useState({});
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () =>
      api('/subsidies')
        .then((rows) => {
          setSubsidies(rows);
          setAmounts(Object.fromEntries(rows.map((s) => [s.id, s.amount != null ? String(Number(s.amount)) : ''])));
        })
        .catch((e) => setError(e.message)),
    [],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function advance(s) {
    setBusy(true);
    setError('');
    try {
      await api(`/subsidies/${s.id}`, { method: 'PATCH', body: { advance: true, amount: amounts[s.id] } });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Subsidies</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Government rooftop subsidy applications. Created automatically when a customer asked for one.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {subsidies.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          No subsidy applications yet.
        </div>
      ) : (
        subsidies.map((s) => {
          const index = STAGES.indexOf(s.stage);
          const done = index === STAGES.length - 1;
          return (
            <section key={s.id} className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-semibold text-slate-800 dark:text-slate-100">{s.order.customer.name}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Order #{s.order.id} · {s.order.kit?.name} · {s.scheme || 'Scheme not set'} · updated {formatDate(s.stageUpdatedAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="0"
                    placeholder="Amount ₹"
                    disabled={done}
                    className="w-32 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
                    value={amounts[s.id] ?? ''}
                    onChange={(e) => setAmounts({ ...amounts, [s.id]: e.target.value })}
                  />
                  {!done && (
                    <button
                      onClick={() => advance(s)}
                      disabled={busy}
                      className="inline-flex items-center gap-1 rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                    >
                      {statusLabel(STAGES[index + 1])} <ChevronRight size={15} />
                    </button>
                  )}
                </div>
              </div>

              {/* Stage stepper */}
              <ol className="mt-4 grid grid-cols-6 gap-1">
                {STAGES.map((stage, i) => (
                  <li key={stage} className="text-center">
                    <div className={`h-1.5 rounded-full ${i <= index ? 'bg-amber-500' : 'bg-slate-200 dark:bg-slate-800'}`} />
                    <p
                      className={`mt-1.5 text-[11px] leading-tight ${
                        i <= index ? 'font-medium text-slate-700 dark:text-slate-200' : 'text-slate-400'
                      }`}
                    >
                      {statusLabel(stage)}
                    </p>
                  </li>
                ))}
              </ol>
              {done && s.amount != null && (
                <p className="mt-3 text-sm text-emerald-700 dark:text-emerald-300">
                  {formatINR(s.amount)} disbursed to the customer
                </p>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
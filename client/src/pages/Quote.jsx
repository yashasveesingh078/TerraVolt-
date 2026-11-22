import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Printer, Sun } from 'lucide-react';
import { api } from '../api.js';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { formatDate, formatINR, systemTypeLabel } from '../utils/format.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';

export default function Quote() {
  const { token } = useParams();
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState('');
  const [name, setName] = useState('');
  const [agree, setAgree] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    () => api(`/public/quote/${token}`).then(setQuote).catch((e) => setError(e.message)),
    [token],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function accept(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/public/quote/${token}/accept`, { method: 'POST', body: { name } });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (!quote) {
    return (
      <div className="min-h-screen bg-slate-50 p-10 text-center text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        {error || 'Loading…'}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 px-4 py-8 dark:bg-slate-950 print:bg-white print:py-0">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-center justify-between print:hidden">
          <div className="flex items-center gap-2 font-bold text-slate-800 dark:text-slate-100">
            <Sun className="text-amber-500" /> {quote.companyName}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <Printer size={16} /> Print / PDF
            </button>
            <ThemeToggle />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 dark:border-slate-800 dark:bg-slate-900 print:border-0 print:p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">Quotation</p>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">#{quote.id}</h1>
              <p className="text-sm text-slate-500 dark:text-slate-400">{formatDate(quote.createdAt)}</p>
            </div>
            <div className="text-right text-sm">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{quote.customer.name}</p>
              <p className="max-w-xs text-slate-500 dark:text-slate-400">{quote.installAddress}</p>
            </div>
          </div>

          {quote.kit && (
            <p className="mt-5 text-lg font-semibold text-slate-800 dark:text-slate-100">
              {quote.kit.kw} kW {systemTypeLabel[quote.kit.type]} solar system
            </p>
          )}

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 text-right font-medium">Qty</th>
                  <th className="py-2 text-right font-medium">Rate</th>
                  <th className="py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                {quote.lines.map((l) => (
                  <tr key={l.id}>
                    <td className="py-2.5">{l.description}</td>
                    <td className="py-2.5 text-right">{l.qty}</td>
                    <td className="py-2.5 text-right">{formatINR(l.unitPrice)}</td>
                    <td className="py-2.5 text-right">{formatINR(l.lineTotal)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <dl className="ml-auto mt-4 max-w-xs space-y-1.5 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <dt>Subtotal</dt>
              <dd>{formatINR(quote.subtotal)}</dd>
            </div>
            <div className="flex justify-between text-slate-600 dark:text-slate-400">
              <dt>GST ({quote.gstPercent}%)</dt>
              <dd>{formatINR(quote.taxAmount)}</dd>
            </div>
            <div className="flex justify-between text-lg font-bold text-slate-800 dark:text-slate-100">
              <dt>Total</dt>
              <dd>{formatINR(quote.total)}</dd>
            </div>
          </dl>

          <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
            Price based on the site survey of your roof. Installation is scheduled after the advance payment.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300 print:hidden">
            {error}
          </div>
        )}

        {quote.status === 'QUOTE' ? (
          <form
            onSubmit={accept}
            className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900 print:hidden"
          >
            <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Accept this quotation</h2>
            <input
              required
              className={inputClass}
              placeholder="Type your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <input type="checkbox" className="mt-1" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              I accept this quotation and understand our team will contact me to collect the advance.
            </label>
            <button
              type="submit"
              disabled={busy || !agree}
              className="w-full rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
            >
              {busy ? 'Accepting…' : 'Accept quotation'}
            </button>
          </form>
        ) : (
          <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
            <CheckCircle2 size={20} className="mt-0.5 shrink-0" />
            <p>
              Accepted by <strong>{quote.acceptedByName}</strong> on {formatDate(quote.acceptedAt, true)}. Thank you! Our
              team will contact you shortly.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
import { useState } from 'react';
import { MapPin, Phone, ScanLine, ShieldCheck, ShieldX, Package } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate } from '../utils/format.js';

const card = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';

export default function SerialSearch() {
  const [input, setInput] = useState('');
  const [unit, setUnit] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function search(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setBusy(true);
    setError('');
    setUnit(null);
    try {
      setUnit(await api(`/inventory/serials/${encodeURIComponent(input.trim())}`));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const monthsLeft = unit?.warrantyEnd
    ? Math.max(0, Math.round((new Date(unit.warrantyEnd) - new Date()) / (30.44 * 24 * 60 * 60 * 1000)))
    : 0;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Serial search</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Scan any panel, inverter or battery to see whose roof it is on and whether it is under warranty.
        </p>
      </div>

      <form onSubmit={search} className="flex gap-2">
        <div className="relative flex-1">
          <ScanLine size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            autoFocus
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 font-mono text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            placeholder="e.g. PNL-0003"
            value={input}
            onChange={(e) => setInput(e.target.value)}
          />
        </div>
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-amber-500 px-5 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
        >
          Search
        </button>
      </form>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {unit && (
        <div className="space-y-4">
          {unit.inWarranty === true && (
            <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ShieldCheck size={28} className="shrink-0" />
              <div>
                <p className="font-semibold">In warranty</p>
                <p className="text-sm">
                  Until {formatDate(unit.warrantyEnd)} · about {monthsLeft} months left
                </p>
              </div>
            </div>
          )}
          {unit.inWarranty === false && (
            <div className="flex items-center gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
              <ShieldX size={28} className="shrink-0" />
              <div>
                <p className="font-semibold">Warranty expired</p>
                <p className="text-sm">Ended on {formatDate(unit.warrantyEnd)}, so repairs are chargeable</p>
              </div>
            </div>
          )}
          {unit.inWarranty === null && (
            <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-slate-700 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-300">
              <Package size={28} className="shrink-0" />
              <p className="text-sm">Not delivered yet. This unit is still in the warehouse.</p>
            </div>
          )}

          <section className={card}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-mono text-lg font-bold text-slate-800 dark:text-slate-100">{unit.serialNo}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {unit.product.name} · {unit.product.sku} · {unit.product.warrantyMonths / 12} yr warranty
                </p>
              </div>
              <StatusBadge status={unit.status} />
            </div>

            {unit.customer && (
              <div className="mt-4 space-y-1.5 border-t border-slate-200 pt-4 text-sm text-slate-700 dark:border-slate-800 dark:text-slate-300">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{unit.customer.name}</p>
                <p className="flex items-start gap-2">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" /> {unit.customer.address}
                  {unit.customer.city ? `, ${unit.customer.city}` : ''}
                </p>
                <p className="flex items-center gap-2">
                  <Phone size={15} className="shrink-0 text-slate-400" /> {unit.customer.phone}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Order #{unit.order?.id} · {unit.order?.kit?.name} · delivered {formatDate(unit.deliveredAt)}
                </p>
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
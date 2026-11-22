import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, ScanLine, ShieldCheck, ShieldX } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, statusLabel } from '../utils/format.js';

const TABS = ['ALL', 'OPEN', 'DIAGNOSED', 'IN_REPAIR', 'AWAITING_CUSTOMER', 'CLOSED'];
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const th = 'px-4 py-3 font-medium';
const td = 'px-4 py-3';

export default function Tickets() {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString('en-CA');
  const [tickets, setTickets] = useState([]);
  const [tab, setTab] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [serial, setSerial] = useState('');
  const [unit, setUnit] = useState(null);
  const [form, setForm] = useState({ fault: '', faultDate: today, assignedToId: '' });
  const [technicians, setTechnicians] = useState([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api('/tickets')
      .then(setTickets)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
    api('/users/technicians').then(setTechnicians).catch(() => {});
  }, []);

  async function lookup(e) {
    e.preventDefault();
    setUnit(null);
    setError('');
    try {
      setUnit(await api(`/inventory/serials/${encodeURIComponent(serial.trim())}`));
    } catch (err) {
      setError(err.message);
    }
  }

  async function createTicket(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const ticket = await api('/tickets', { method: 'POST', body: { serialNo: unit.serialNo, ...form } });
      navigate(`/tickets/${ticket.id}`);
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  }

  const shown = tab === 'ALL' ? tickets : tickets.filter((t) => t.status === tab);

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Service tickets</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Warranty is decided automatically from the serial number.</p>
        </div>
        <button
          onClick={() => setShowNew(!showNew)}
          className="inline-flex items-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
        >
          <Plus size={16} /> New ticket
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {showNew && (
        <section className="space-y-4 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <form onSubmit={lookup} className="flex gap-2">
            <div className="relative flex-1">
              <ScanLine size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                autoFocus
                className={`${inputClass} pl-10 font-mono`}
                placeholder="Serial of the faulty unit, e.g. INV-3K-0001"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
              />
            </div>
            <button type="submit" className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-700">
              Find
            </button>
          </form>

          {unit && (
            <>
              <div
                className={`flex items-start gap-3 rounded-lg p-3 text-sm ${
                  unit.inWarranty
                    ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'bg-rose-50 text-rose-800 dark:bg-rose-500/10 dark:text-rose-300'
                }`}
              >
                {unit.inWarranty ? <ShieldCheck size={20} className="shrink-0" /> : <ShieldX size={20} className="shrink-0" />}
                <div>
                  <p className="font-semibold">
                    {unit.product.name} · {unit.serialNo} · {unit.customer?.name || 'not at a customer'}
                  </p>
                  <p>
                    {unit.warrantyEnd ? `Warranty until ${formatDate(unit.warrantyEnd)}` : 'No warranty date'}. The final
                    decision uses the fault date below.
                  </p>
                </div>
              </div>

              <form onSubmit={createTicket} className="grid gap-3 sm:grid-cols-2">
                <textarea
                  required
                  rows={2}
                  className={`${inputClass} sm:col-span-2`}
                  placeholder="What is wrong? e.g. Inverter shows error E03, no output"
                  value={form.fault}
                  onChange={(e) => setForm({ ...form, fault: e.target.value })}
                />
                <label className="text-sm text-slate-700 dark:text-slate-300">
                  Fault date
                  <input
                    type="date"
                    max={today}
                    required
                    className={`${inputClass} mt-1`}
                    value={form.faultDate}
                    onChange={(e) => setForm({ ...form, faultDate: e.target.value })}
                  />
                </label>
                <label className="text-sm text-slate-700 dark:text-slate-300">
                  Technician
                  <select
                    className={`${inputClass} mt-1`}
                    value={form.assignedToId}
                    onChange={(e) => setForm({ ...form, assignedToId: e.target.value })}
                  >
                    <option value="">Assign later</option>
                    {technicians.map((t) => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50 sm:col-span-2"
                >
                  {busy ? 'Opening…' : 'Open ticket'}
                </button>
              </form>
            </>
          )}
        </section>
      )}

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
          </button>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
            <tr>
              <th className={th}>Ticket</th>
              <th className={th}>Customer</th>
              <th className={th}>Unit</th>
              <th className={th}>Warranty</th>
              <th className={th}>Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
            {loading ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">Loading…</td></tr>
            ) : shown.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500 dark:text-slate-400">No tickets here.</td></tr>
            ) : (
              shown.map((t) => (
                <tr
                  key={t.id}
                  onClick={() => navigate(`/tickets/${t.id}`)}
                  className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                >
                  <td className={td}>
                    <div className="font-medium text-slate-800 dark:text-slate-100">#{t.id}</div>
                    <div className="text-xs text-slate-500 dark:text-slate-400">{formatDate(t.createdAt)}</div>
                  </td>
                  <td className={td}>{t.customer.name}</td>
                  <td className={td}>
                    <div>{t.serialUnit.product.name}</div>
                    <div className="font-mono text-xs text-slate-500 dark:text-slate-400">{t.serialUnit.serialNo}</div>
                  </td>
                  <td className={td}>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        t.underWarranty
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300'
                      }`}
                    >
                      {t.underWarranty ? 'Free (warranty)' : 'Chargeable'}
                    </span>
                  </td>
                  <td className={td}><StatusBadge status={t.status} /></td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
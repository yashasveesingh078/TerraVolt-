import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, Phone, ShieldCheck, ShieldX, Wrench } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatINR, statusLabel } from '../utils/format.js';

const MOVES = { OPEN: ['DIAGNOSED'], DIAGNOSED: ['IN_REPAIR'], IN_REPAIR: ['AWAITING_CUSTOMER'], AWAITING_CUSTOMER: ['IN_REPAIR'] };
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const card = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
const cardTitle = 'mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';
const emptyLine = { type: 'PART', productId: '', qty: '1', replacementSerial: '', description: '' };

export default function TicketDetail() {
  const { id } = useParams();
  const [ticket, setTicket] = useState(null);
  const [parts, setParts] = useState([]);
  const [technicians, setTechnicians] = useState([]);
  const [line, setLine] = useState(emptyLine);
  const [closeName, setCloseName] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => api(`/tickets/${id}`).then(setTicket).catch((e) => setError(e.message)), [id]);

  useEffect(() => {
    load();
    api('/tickets/parts').then(setParts).catch(() => {});
    api('/users/technicians').then(setTechnicians).catch(() => {});
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

  const update = (body) => run(() => api(`/tickets/${id}`, { method: 'PATCH', body }));

  async function addLine(e) {
    e.preventDefault();
    const body = { ...line, productId: Number(line.productId) || undefined, qty: Number(line.qty) };
    if (await run(() => api(`/tickets/${id}/lines`, { method: 'POST', body }))) setLine(emptyLine);
  }

  async function closeTicket(e) {
    e.preventDefault();
    await run(() => api(`/tickets/${id}/close`, { method: 'POST', body: { confirmedByName: closeName } }));
  }

  if (!ticket) return <div className="p-10 text-center text-slate-500 dark:text-slate-400">{error || 'Loading…'}</div>;

  const free = ticket.underWarranty;
  const closed = ticket.status === 'CLOSED';
  const part = parts.find((p) => p.id === Number(line.productId));
  const totalCost = ticket.repairLines.reduce((s, l) => s + Number(l.cost), 0);
  const totalCharged = ticket.repairLines.reduce((s, l) => s + Number(l.priceCharged), 0);
  const priceHint = free
    ? 0
    : line.type === 'LABOUR'
      ? ticket.labourRate * (Number(line.qty) || 0)
      : part
        ? Number(part.salePrice) * (part.isSerialized ? 1 : Number(line.qty) || 0)
        : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          to="/tickets"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> All tickets
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Ticket #{ticket.id} · {ticket.customer.name}
          </h1>
          <StatusBadge status={ticket.status} />
        </div>
      </div>

      {/* ★ The automatic warranty decision, with its reason */}
      <div
        className={`flex items-start gap-3 rounded-xl border p-4 ${
          free
            ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300'
            : 'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300'
        }`}
      >
        {free ? <ShieldCheck size={26} className="shrink-0" /> : <ShieldX size={26} className="shrink-0" />}
        <div>
          <p className="font-semibold">{free ? 'Under warranty: customer pays nothing' : 'Out of warranty: repair is chargeable'}</p>
          <p className="text-sm">{ticket.warrantyReason}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className={card}>
            <h2 className={cardTitle}>Fault</h2>
            <p className="text-slate-800 dark:text-slate-100">{ticket.fault}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              {ticket.serialUnit.product.name} · <span className="font-mono">{ticket.serialUnit.serialNo}</span> · fault on{' '}
              {formatDate(ticket.faultDate)} · unit {statusLabel(ticket.serialUnit.status).toLowerCase()}
            </p>
          </section>

          <section className={card}>
            <h2 className={cardTitle}>Repair work</h2>
            {ticket.repairLines.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Nothing added yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <tr>
                      <th className="py-2 font-medium">Work</th>
                      <th className="py-2 text-right font-medium">Qty</th>
                      <th className="py-2 text-right font-medium">Our cost</th>
                      <th className="py-2 text-right font-medium">Charged</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                    {ticket.repairLines.map((l) => (
                      <tr key={l.id}>
                        <td className="py-2.5">
                          <span className="mr-2 text-xs text-slate-400">{l.type === 'PART' ? 'Part' : 'Labour'}</span>
                          {l.description}
                        </td>
                        <td className="py-2.5 text-right">{Number(l.qty)}</td>
                        <td className="py-2.5 text-right">{formatINR(l.cost)}</td>
                        <td className="py-2.5 text-right font-medium">{formatINR(l.priceCharged)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="border-t border-slate-200 font-semibold text-slate-800 dark:border-slate-800 dark:text-slate-100">
                    <tr>
                      <td className="py-2.5" colSpan={2}>Total</td>
                      <td className="py-2.5 text-right">{formatINR(totalCost)}</td>
                      <td className="py-2.5 text-right">{formatINR(totalCharged)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
            {free && totalCost > 0 && (
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                Warranty cost to the company: {formatINR(totalCost)} (shown in the director's job profit)
              </p>
            )}

            {!closed && (
              <form onSubmit={addLine} className="mt-5 grid gap-3 border-t border-slate-200 pt-5 sm:grid-cols-4 dark:border-slate-800">
                <select
                  className={inputClass}
                  value={line.type}
                  onChange={(e) => setLine({ ...emptyLine, type: e.target.value })}
                >
                  <option value="PART">Part</option>
                  <option value="LABOUR">Labour</option>
                </select>

                {line.type === 'PART' ? (
                  <>
                    <select
                      required
                      className={`${inputClass} sm:col-span-2`}
                      value={line.productId}
                      onChange={(e) => setLine({ ...line, productId: e.target.value, replacementSerial: '' })}
                    >
                      <option value="">Choose part…</option>
                      {parts.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.isSerialized ? ' (serial)' : ''}
                        </option>
                      ))}
                    </select>
                    {part?.isSerialized ? (
                      <input
                        required
                        className={`${inputClass} font-mono`}
                        placeholder="New unit serial"
                        value={line.replacementSerial}
                        onChange={(e) => setLine({ ...line, replacementSerial: e.target.value })}
                      />
                    ) : (
                      <input
                        type="number"
                        min="1"
                        required
                        className={inputClass}
                        value={line.qty}
                        onChange={(e) => setLine({ ...line, qty: e.target.value })}
                      />
                    )}
                  </>
                ) : (
                  <>
                    <input
                      className={`${inputClass} sm:col-span-2`}
                      placeholder="What was done"
                      value={line.description}
                      onChange={(e) => setLine({ ...line, description: e.target.value })}
                    />
                    <input
                      type="number"
                      step="0.5"
                      min="0.5"
                      required
                      placeholder="Hours"
                      className={inputClass}
                      value={line.qty}
                      onChange={(e) => setLine({ ...line, qty: e.target.value })}
                    />
                  </>
                )}

                <p className="self-center text-sm text-slate-600 sm:col-span-3 dark:text-slate-400">
                  Customer pays: <strong>{formatINR(priceHint)}</strong>
                  {free && ' (warranty)'}
                </p>
                <button type="submit" disabled={busy} className={primaryBtn}>
                  <Wrench size={16} /> Add
                </button>
              </form>
            )}
          </section>
        </div>

        <div className="space-y-6">
          <section className={card}>
            <h2 className={cardTitle}>Customer</h2>
            <div className="space-y-1.5 text-sm text-slate-700 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">{ticket.customer.name}</p>
              <p className="flex items-start gap-2">
                <MapPin size={15} className="mt-0.5 shrink-0 text-slate-400" /> {ticket.customer.address}
              </p>
              <a href={`tel:${ticket.customer.phone}`} className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                <Phone size={15} /> {ticket.customer.phone}
              </a>
            </div>
          </section>

          {!closed && (
            <section className={`${card} space-y-3`}>
              <h2 className={cardTitle}>Progress</h2>
              <select
                className={inputClass}
                value={ticket.assignedTo?.id || ''}
                onChange={(e) => update({ assignedToId: e.target.value ? Number(e.target.value) : null })}
              >
                <option value="">No technician</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              {(MOVES[ticket.status] || []).map((next) => (
                <button key={next} onClick={() => update({ status: next })} disabled={busy} className={`${secondaryBtn} w-full`}>
                  Mark as {statusLabel(next).toLowerCase()}
                </button>
              ))}
            </section>
          )}

          {!closed ? (
            <form onSubmit={closeTicket} className={`${card} space-y-3`}>
              <h2 className={cardTitle}>Close ticket</h2>
              <input
                required
                className={inputClass}
                placeholder="Customer name (confirms the repair)"
                value={closeName}
                onChange={(e) => setCloseName(e.target.value)}
              />
              <button type="submit" disabled={busy || ticket.repairLines.length === 0} className={`${primaryBtn} w-full`}>
                <CheckCircle2 size={16} /> Close {free ? '(no invoice)' : '& raise invoice'}
              </button>
            </form>
          ) : (
            <section className={card}>
              <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 size={18} /> Closed {formatDate(ticket.closedAt, true)}, confirmed by {ticket.confirmedByName}
              </p>
              {ticket.invoice ? (
                <div className="mt-3 flex items-center justify-between text-sm">
                  <span className="text-slate-700 dark:text-slate-300">{ticket.invoice.number}</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-100">{formatINR(ticket.invoice.amount)}</span>
                  <StatusBadge status={ticket.invoice.status} />
                </div>
              ) : (
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">No invoice: repaired under warranty.</p>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
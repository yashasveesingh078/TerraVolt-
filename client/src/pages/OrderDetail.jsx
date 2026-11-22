import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { AlertTriangle, ArrowLeft, CheckCircle2, Copy, ExternalLink, MessageCircle, Wallet } from 'lucide-react';
import { api } from '../api.js';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate, formatINR, statusLabel, systemTypeLabel } from '../utils/format.js';

const METHODS = ['UPI', 'CASH', 'BANK_TRANSFER', 'CHEQUE', 'CARD'];
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const card = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';
const cardTitle = 'mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400';
const primaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50';
const secondaryBtn =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';

export default function OrderDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const [order, setOrder] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [payment, setPayment] = useState({ amount: '', method: 'UPI', reference: '' });

  const load = useCallback(
    () =>
      api(`/orders/${id}`)
        .then((o) => {
          setOrder(o);
          // Suggest the standard advance (30% unless the director set advance_percent)
          setPayment((p) => ({ ...p, amount: p.amount || String(Math.round((Number(o.total) * o.advancePercent) / 100)) }));
        })
        .catch((e) => setError(e.message)),
    [id],
  );

  useEffect(() => {
    load();
  }, [load]);

  async function confirmOrder(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api(`/orders/${id}/confirm`, { method: 'POST', body: payment });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function copyLink(url) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Could not copy. Select the link and copy it by hand.');
    }
  }

  if (!order) {
    return <div className="p-10 text-center text-slate-500 dark:text-slate-400">{error || 'Loading…'}</div>;
  }

  const quoteUrl = `${window.location.origin}/quote/${order.quoteToken}`;
  const whatsappUrl = `https://wa.me/91${order.customer.phone}?text=${encodeURIComponent(
    `Hello ${order.customer.name}, here is your solar quotation from TerraVolt: ${quoteUrl}`,
  )}`;
  const showCost = user.role !== 'SALES'; // margin is for director and accounts
  const cost = order.lines.reduce((sum, l) => sum + Number(l.unitCost) * l.qty, 0);
  const margin = Number(order.subtotal) - cost;
  const marginPercent = Number(order.subtotal) > 0 ? (margin / Number(order.subtotal)) * 100 : 0;
  const paid = order.invoices.flatMap((inv) => inv.payments).reduce((sum, p) => sum + Number(p.amount), 0);
  const balance = Number(order.total) - paid;
  const beforeConfirm = order.status === 'QUOTE' || order.status === 'ACCEPTED';
    const shortLines = order.lines.filter((l) => l.available !== null && l.available < l.qty);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <Link
          to="/orders"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> All orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Order #{order.id} · {order.customer.name}
          </h1>
          <StatusBadge status={order.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {order.kit ? `${order.kit.kw} kW ${systemTypeLabel[order.kit.type]} · ${order.kit.name}` : ''} · created{' '}
          {formatDate(order.createdAt)}
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left: the quotation itself */}
        <div className="space-y-6 lg:col-span-2">
          <section className={card}>
            <h2 className={cardTitle}>Items</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-left text-sm">
                <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="py-2 font-medium">Item</th>
                    <th className="py-2 text-right font-medium">Qty</th>
                    <th className="py-2 text-right font-medium">Unit price</th>
                    <th className="py-2 text-right font-medium">Total</th>
                                          {beforeConfirm && (
                        <td
                          className={`py-2.5 text-right ${
                            l.available !== null && l.available < l.qty ? 'font-semibold text-rose-600 dark:text-rose-400' : ''
                          }`}
                        >
                          {l.available === null ? '—' : l.available}
                        </td>
                      )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                  {order.lines.map((l) => (
                    <tr key={l.id}>
                      <td className="py-2.5">{l.description}</td>
                      <td className="py-2.5 text-right">{l.qty}</td>
                      <td className="py-2.5 text-right">{formatINR(l.unitPrice)}</td>
                      <td className="py-2.5 text-right font-medium">{formatINR(l.lineTotal)}</td>
                      {beforeConfirm && (
                        <td
                          className={`py-2.5 text-right ${
                            l.product.stockQty < l.qty ? 'font-semibold text-rose-600 dark:text-rose-400' : ''
                          }`}
                        >
                          {l.product.stockQty}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <dl className="ml-auto mt-4 max-w-xs space-y-1.5 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <dt>Subtotal</dt>
                <dd>{formatINR(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between text-slate-600 dark:text-slate-400">
                <dt>GST</dt>
                <dd>{formatINR(order.taxAmount)}</dd>
              </div>
              <div className="flex justify-between text-base font-bold text-slate-800 dark:text-slate-100">
                <dt>Total</dt>
                <dd>{formatINR(order.total)}</dd>
              </div>
            </dl>
          </section>

          {order.invoices.length > 0 && (
            <section className={card}>
              <h2 className={cardTitle}>Payments</h2>
              <ul className="divide-y divide-slate-100 text-sm dark:divide-slate-800">
                {order.invoices.map((inv) => (
                  <li key={inv.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-100">
                        {inv.number} · {statusLabel(inv.type)}
                      </p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {formatDate(inv.issueDate)}
                        {inv.payments.map((p) => ` · ${statusLabel(p.method)}${p.reference ? ` ${p.reference}` : ''}`)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{formatINR(inv.amount)}</span>
                      <StatusBadge status={inv.status} />
                    </div>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-slate-200 pt-3 text-sm font-semibold dark:border-slate-800">
                <span className="text-slate-600 dark:text-slate-400">Balance due</span>
                <span className="text-slate-800 dark:text-slate-100">{formatINR(balance)}</span>
              </div>
            </section>
          )}
        </div>

        {/* Right: what to do next */}
        <div className="space-y-6">
          {order.status === 'QUOTE' && (
            <section className={card}>
              <h2 className={cardTitle}>Send to customer</h2>
              <p className="break-all rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                {quoteUrl}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <button onClick={() => copyLink(quoteUrl)} className={secondaryBtn}>
                  <Copy size={15} /> {copied ? 'Copied' : 'Copy'}
                </button>
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className={secondaryBtn}>
                  <MessageCircle size={15} /> WhatsApp
                </a>
                <a href={quoteUrl} target="_blank" rel="noreferrer" className={secondaryBtn}>
                  <ExternalLink size={15} /> Open
                </a>
              </div>
              <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                The customer opens the link, checks the items and accepts by typing their name.
              </p>
            </section>
          )}

          {order.acceptedAt && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
              <span>
                Accepted by <strong>{order.acceptedByName}</strong> on {formatDate(order.acceptedAt, true)}
              </span>
            </div>
          )}

          {order.status === 'ACCEPTED' && (
            <form onSubmit={confirmOrder} className={`${card} space-y-3`}>
              <h2 className={cardTitle}>Record advance & confirm</h2>
              {shortLines.length > 0 && (
                <p className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-300">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                  Not enough stock for {shortLines.map((l) => l.description).join(', ')}. Restock before confirming.
                </p>
              )}
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Amount (₹) <span className="text-xs text-slate-500">· suggested {order.advancePercent}%</span>
                <input
                  type="number"
                  min="1"
                  required
                  className={`${inputClass} mt-1`}
                  value={payment.amount}
                  onChange={(e) => setPayment({ ...payment, amount: e.target.value })}
                />
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Method
                <select
                  className={`${inputClass} mt-1`}
                  value={payment.method}
                  onChange={(e) => setPayment({ ...payment, method: e.target.value })}
                >
                  {METHODS.map((m) => (
                    <option key={m} value={m}>{statusLabel(m)}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-slate-700 dark:text-slate-300">
                Reference (UPI ID / cheque no.)
                <input
                  className={`${inputClass} mt-1`}
                  value={payment.reference}
                  onChange={(e) => setPayment({ ...payment, reference: e.target.value })}
                />
              </label>
              <button type="submit" disabled={busy || shortLines.length > 0} className={`${primaryBtn} w-full`}>
                <Wallet size={16} /> {busy ? 'Confirming…' : 'Record advance & confirm order'}
              </button>
            </form>
          )}

          {!beforeConfirm && (
            <section className={card}>
              <h2 className={cardTitle}>Hand-over</h2>
              <dl className="space-y-2 text-sm">
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Confirmed</dt>
                  <dd className="text-slate-800 dark:text-slate-100">{formatDate(order.confirmedAt, true)}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Delivery</dt>
                  <dd>{order.delivery ? <StatusBadge status={order.delivery.status} /> : '—'}</dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Install team</dt>
                  <dd className="text-right text-slate-800 dark:text-slate-100">
                    {order.job?.technicians.map((t) => t.name).join(', ') || 'Not assigned'}
                  </dd>
                </div>
                <div className="flex justify-between gap-3">
                  <dt className="text-slate-500 dark:text-slate-400">Install address</dt>
                  <dd className="text-right text-slate-800 dark:text-slate-100">{order.installAddress}</dd>
                </div>
              </dl>
            </section>
          )}

          {showCost && (
            <section className={card}>
              <h2 className={cardTitle}>Margin (staff only)</h2>
              <dl className="space-y-1.5 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <dt>Material cost</dt>
                  <dd>{formatINR(cost)}</dd>
                </div>
                <div className="flex justify-between font-semibold text-slate-800 dark:text-slate-100">
                  <dt>Gross margin</dt>
                  <dd>
                    {formatINR(margin)} ({marginPercent.toFixed(1)}%)
                  </dd>
                </div>
              </dl>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Before labour and warranty repairs.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, MapPin, Phone, ScanLine, Truck, X } from 'lucide-react';
import { api } from '../api.js';
import StatusBadge from '../components/StatusBadge.jsx';
import { formatDate } from '../utils/format.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 font-mono text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const card = 'rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900';

export default function Dispatch() {
  const { id } = useParams();
  const [delivery, setDelivery] = useState(null);
  const [scanned, setScanned] = useState([]);
  const [input, setInput] = useState('');
  const [message, setMessage] = useState(null); // { ok, text }
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    api(`/inventory/deliveries/${id}`).then(setDelivery).catch((e) => setError(e.message));
  }, [id]);

  if (!delivery) {
    return <div className="p-10 text-center text-slate-500 dark:text-slate-400">{error || 'Loading…'}</div>;
  }

  const { order } = delivery;
  const isPending = delivery.status === 'PENDING';
  const unitBySerial = new Map(delivery.units.map((u) => [u.serialNo, u]));
  const serialLines = order.lines.filter((l) => l.product.isSerialized);
  const looseLines = order.lines.filter((l) => !l.product.isSerialized && l.product.category !== 'SERVICE');
  const nameByProduct = Object.fromEntries(order.lines.map((l) => [l.productId, l.description]));
  const scannedFor = (productId) => scanned.filter((s) => unitBySerial.get(s)?.productId === productId);
  const complete = serialLines.every((l) => scannedFor(l.productId).length === l.qty);

  // A barcode scanner types the code and presses Enter, so this works with a scanner or a keyboard
  function addSerial(e) {
    e.preventDefault();
    const serial = input.trim().toUpperCase();
    setInput('');
    inputRef.current?.focus();
    if (!serial) return;

    const unit = unitBySerial.get(serial);
    const line = unit && serialLines.find((l) => l.productId === unit.productId);
    if (scanned.includes(serial)) setMessage({ ok: false, text: `${serial} is already scanned` });
    else if (!unit) setMessage({ ok: false, text: `${serial} is not available for this order` });
    else if (scannedFor(line.productId).length >= line.qty) {
      setMessage({ ok: false, text: `Already have all ${line.qty} × ${line.description}` });
    } else {
      setScanned([...scanned, serial]);
      setMessage({ ok: true, text: `✓ ${serial} · ${line.description}` });
    }
  }

  // Demo helper: fill with the units reserved at confirmation
  function useReserved() {
    const picked = serialLines.flatMap((line) =>
      delivery.units
        .filter((u) => u.productId === line.productId)
        .sort((a, b) => (b.orderId === order.id) - (a.orderId === order.id))
        .slice(0, line.qty)
        .map((u) => u.serialNo),
    );
    setScanned(picked);
    setMessage({ ok: true, text: 'Filled with the units reserved for this order' });
  }

  async function dispatch() {
    setBusy(true);
    setError('');
    try {
      await api(`/inventory/deliveries/${id}/dispatch`, { method: 'POST', body: { serials: scanned } });
      setDelivery(await api(`/inventory/deliveries/${id}`));
      setScanned([]);
      setMessage(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          to="/inventory"
          className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <ArrowLeft size={16} /> Inventory
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">
            Dispatch · {order.customer.name}
          </h1>
          <StatusBadge status={delivery.status} />
        </div>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Order #{order.id} · {order.kit?.name}
        </p>
      </div>

      <section className={`${card} grid gap-2 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300`}>
        <p className="flex items-start gap-2">
          <MapPin size={16} className="mt-0.5 shrink-0 text-slate-400" /> {order.installAddress}
        </p>
        <p className="flex items-center gap-2">
          <Phone size={16} className="shrink-0 text-slate-400" /> {order.customer.phone}
        </p>
      </section>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {isPending ? (
        <>
          <section className={`${card} space-y-3`}>
            <form onSubmit={addSerial} className="flex gap-2">
              <div className="relative flex-1">
                <ScanLine size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  ref={inputRef}
                  autoFocus
                  className={`${inputClass} pl-10`}
                  placeholder="Scan barcode or type serial, then Enter"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                />
              </div>
              <button
                type="submit"
                className="rounded-lg bg-slate-800 px-4 text-sm font-medium text-white hover:bg-slate-700 dark:bg-slate-700 dark:hover:bg-slate-600"
              >
                Add
              </button>
            </form>
            {message && (
              <p className={`text-sm ${message.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {message.text}
              </p>
            )}
            <button onClick={useReserved} className="text-xs font-medium text-amber-600 hover:underline dark:text-amber-400">
              Use reserved units (quick fill)
            </button>
          </section>

          <div className="grid gap-4 sm:grid-cols-2">
            {serialLines.map((line) => {
              const got = scannedFor(line.productId);
              const done = got.length === line.qty;
              return (
                <section key={line.id} className={`${card} ${done ? 'border-emerald-300 dark:border-emerald-500/40' : ''}`}>
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-slate-800 dark:text-slate-100">{line.description}</p>
                    <span
                      className={`text-sm font-semibold ${done ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}
                    >
                      {got.length} / {line.qty}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {got.map((serial) => (
                      <span
                        key={serial}
                        className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pl-3 pr-1.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      >
                        {serial}
                        <button
                          onClick={() => setScanned(scanned.filter((s) => s !== serial))}
                          aria-label={`Remove ${serial}`}
                          className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))}
                    {got.length === 0 && <span className="text-xs text-slate-400">Nothing scanned yet</span>}
                  </div>
                </section>
              );
            })}
          </div>

          {looseLines.length > 0 && (
            <section className={card}>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">Also pack</p>
              <ul className="grid gap-1 text-sm text-slate-700 sm:grid-cols-2 dark:text-slate-300">
                {looseLines.map((l) => (
                  <li key={l.id}>
                    {l.qty} × {l.description}
                  </li>
                ))}
              </ul>
            </section>
          )}

          <button
            onClick={dispatch}
            disabled={!complete || busy}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-amber-500 px-4 py-3 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
          >
            <Truck size={18} /> {busy ? 'Dispatching…' : complete ? 'Dispatch kit' : 'Scan all serial items to dispatch'}
          </button>
        </>
      ) : (
        <section className={card}>
          <p className="mb-4 flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300">
            <CheckCircle2 size={18} /> Dispatched {formatDate(delivery.dispatchedAt, true)} by {delivery.dispatchedBy?.name}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[480px] text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="py-2 font-medium">Serial</th>
                  <th className="py-2 font-medium">Item</th>
                  <th className="py-2 font-medium">Warranty until</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                {delivery.units.map((u) => (
                  <tr key={u.serialNo}>
                    <td className="py-2 font-mono">{u.serialNo}</td>
                    <td className="py-2">{nameByProduct[u.productId]}</td>
                    <td className="py-2">{formatDate(u.warrantyEnd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
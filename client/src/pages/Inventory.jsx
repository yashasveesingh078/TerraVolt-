import { Fragment, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, MapPin, PackageCheck, Truck } from 'lucide-react';
import { api } from '../api.js';
import { formatDate, statusLabel } from '../utils/format.js';

const TABS = [
  { key: 'PENDING', label: 'To dispatch' },
  { key: 'DISPATCHED', label: 'Dispatched' },
  { key: 'STOCK', label: 'Stock' },
];
const inputClass =
  'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-500/30 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100';
const th = 'px-4 py-3 font-medium';
const td = 'px-4 py-3';

export default function Inventory() {
  const [tab, setTab] = useState('PENDING');
  const [deliveries, setDeliveries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [receiving, setReceiving] = useState(null); // product being restocked
  const [receiveInput, setReceiveInput] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    const request =
      tab === 'STOCK'
        ? api('/inventory/products').then(setProducts)
        : api(`/inventory/deliveries?status=${tab}`).then(setDeliveries);
    return request
      .then(() => setError(''))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [tab]);

  useEffect(() => {
    load();
  }, [load]);

  async function receive(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = receiving.isSerialized ? { serials: receiveInput.split(/[\s,]+/) } : { qty: Number(receiveInput) };
    try {
      await api(`/inventory/products/${receiving.id}/receive`, { method: 'POST', body });
      setReceiving(null);
      setReceiveInput('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const lowCount = products.filter((p) => p.low).length;

  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">Inventory</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Pack and dispatch kits, keep stock topped up.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-sm font-medium ${
              tab === t.key
                ? 'bg-amber-500 text-slate-900'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      )}

      {loading ? (
        <p className="p-10 text-center text-slate-500 dark:text-slate-400">Loading…</p>
      ) : tab !== 'STOCK' ? (
        deliveries.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-300 p-10 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
            {tab === 'PENDING' ? 'Nothing waiting to be dispatched.' : 'No dispatches yet.'}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {deliveries.map((d) => (
              <Link
                key={d.id}
                to={`/inventory/dispatch/${d.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 hover:border-amber-400 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-amber-500/60"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-slate-100">{d.order.customer.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      Order #{d.order.id} · {d.order.kit?.name}
                    </p>
                  </div>
                  {tab === 'PENDING' ? (
                    <PackageCheck className="text-amber-500" size={22} />
                  ) : (
                    <Truck className="text-emerald-500" size={22} />
                  )}
                </div>
                <p className="mt-3 flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
                  <MapPin size={15} className="mt-0.5 shrink-0" /> {d.order.installAddress}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {tab === 'PENDING'
                    ? `Confirmed ${formatDate(d.order.confirmedAt)}`
                    : `Dispatched ${formatDate(d.dispatchedAt, true)} by ${d.dispatchedBy?.name || '—'}`}
                </p>
              </Link>
            ))}
          </div>
        )
      ) : (
        <>
          {lowCount > 0 && (
            <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-500/10 dark:text-amber-300">
              <AlertTriangle size={16} /> {lowCount} item(s) at or below reorder level
            </p>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:text-slate-400">
                <tr>
                  <th className={th}>Item</th>
                  <th className={th}>Category</th>
                  <th className={`${th} text-right`}>Available</th>
                  <th className={`${th} text-right`}>Reserved</th>
                  <th className={th}>Warranty</th>
                  <th className={th}></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                {products.map((p) => (
                  <Fragment key={p.id}>
                    <tr>
                      <td className={td}>
                        <div className="font-medium text-slate-800 dark:text-slate-100">{p.name}</div>
                        <div className="text-xs text-slate-500 dark:text-slate-400">
                          {p.sku}
                          {p.isSerialized ? ' · serial tracked' : ''}
                        </div>
                      </td>
                      <td className={td}>{statusLabel(p.category)}</td>
                      <td className={`${td} text-right`}>
                        <span className={p.low ? 'font-semibold text-rose-600 dark:text-rose-400' : 'font-medium'}>
                          {p.available}
                        </span>
                        {p.low && (
                          <span className="ml-2 rounded-full bg-rose-100 px-2 py-0.5 text-xs text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                            Low
                          </span>
                        )}
                      </td>
                      <td className={`${td} text-right`}>{p.isSerialized ? p.reserved : '—'}</td>
                      <td className={td}>{p.warrantyMonths ? `${p.warrantyMonths / 12} yr` : '—'}</td>
                      <td className={`${td} text-right`}>
                        <button
                          onClick={() => {
                            setReceiving(receiving?.id === p.id ? null : p);
                            setReceiveInput('');
                          }}
                          className="text-sm font-medium text-amber-600 hover:underline dark:text-amber-400"
                        >
                          Receive
                        </button>
                      </td>
                    </tr>
                    {receiving?.id === p.id && (
                      <tr>
                        <td colSpan={6} className="bg-slate-50 px-4 py-3 dark:bg-slate-800/40">
                          <form onSubmit={receive} className="flex flex-col gap-2 sm:flex-row sm:items-start">
                            {p.isSerialized ? (
                              <textarea
                                rows={3}
                                required
                                className={inputClass}
                                placeholder="Scan or type serial numbers, one per line"
                                value={receiveInput}
                                onChange={(e) => setReceiveInput(e.target.value)}
                              />
                            ) : (
                              <input
                                type="number"
                                min="1"
                                required
                                className={`${inputClass} sm:w-40`}
                                placeholder="Quantity"
                                value={receiveInput}
                                onChange={(e) => setReceiveInput(e.target.value)}
                              />
                            )}
                            <button
                              type="submit"
                              disabled={busy}
                              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400 disabled:opacity-50"
                            >
                              Add to stock
                            </button>
                          </form>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
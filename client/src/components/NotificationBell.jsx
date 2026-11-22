import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../api.js';
import { formatDate } from '../utils/format.js';

export default function NotificationBell() {
  const [data, setData] = useState({ items: [], unread: 0 });
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const navigate = useNavigate();

  const load = () => api('/notifications').then(setData).catch(() => {});

  // Load now, then check again every 30 seconds
  useEffect(() => {
    load();
    const timer = setInterval(load, 30000);
    return () => clearInterval(timer);
  }, []);

  // Close the dropdown when clicking anywhere outside it
  useEffect(() => {
    if (!open) return;
    const close = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  async function openItem(item) {
    setOpen(false);
    if (!item.read) await api(`/notifications/${item.id}/read`, { method: 'POST' }).catch(() => {});
    load();
    if (item.link) navigate(item.link);
  }

  async function markAllRead() {
    await api('/notifications/read-all', { method: 'POST' }).catch(() => {});
    load();
  }

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => {
          if (!open) load();
          setOpen(!open);
        }}
        aria-label="Notifications"
        className="relative rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Bell size={20} />
        {data.unread > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
            {data.unread > 9 ? '9+' : data.unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between border-b border-slate-200 px-4 py-2.5 dark:border-slate-800">
            <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">Notifications</span>
            {data.unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-medium text-amber-600 hover:underline dark:text-amber-400">
                Mark all read
              </button>
            )}
          </div>

          {data.items.length === 0 ? (
            <p className="p-6 text-center text-sm text-slate-500 dark:text-slate-400">Nothing yet</p>
          ) : (
            <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
              {data.items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => openItem(item)}
                    className={`block w-full px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 ${
                      item.read ? '' : 'bg-amber-50 dark:bg-amber-500/10'
                    }`}
                  >
                    <p className="text-sm text-slate-800 dark:text-slate-100">{item.message}</p>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{formatDate(item.createdAt, true)}</p>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
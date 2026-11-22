import { statusLabel } from '../utils/format.js';

// One colour per status, with a dark-mode version of each
const colours = {
  NEW: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  CONTACTED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  QUALIFIED: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  SURVEY_REQUESTED: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  SCHEDULED: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  SUBMITTED: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  SURVEY_APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  APPROVED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  QUOTED: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  WON: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  REJECTED: 'bg-rose-100 text-rose-800 dark:bg-rose-500/15 dark:text-rose-300',
  LOST: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    QUOTE: 'bg-teal-100 text-teal-800 dark:bg-teal-500/15 dark:text-teal-300',
  ACCEPTED: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  CONFIRMED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  DISPATCHED: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/15 dark:text-indigo-300',
  INSTALLED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  CLOSED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  CANCELLED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
  PAID: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  PENDING: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
    IN_STOCK: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  DELIVERED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  REPLACED: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
    IN_PROGRESS: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  COMPLETED: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  OPEN: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  DIAGNOSED: 'bg-violet-100 text-violet-800 dark:bg-violet-500/15 dark:text-violet-300',
  IN_REPAIR: 'bg-orange-100 text-orange-800 dark:bg-orange-500/15 dark:text-orange-300',
  AWAITING_CUSTOMER: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  SENT: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  DRAFT: 'bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400',
};

export default function StatusBadge({ status }) {
  const colour = colours[status] || 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300';
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${colour}`}>
      {statusLabel(status)}
    </span>
  );
}
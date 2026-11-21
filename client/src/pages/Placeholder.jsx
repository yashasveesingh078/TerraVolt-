import { Construction } from 'lucide-react';

export default function Placeholder({ title }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">{title}</h1>
      <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 text-slate-500 dark:text-slate-400">
        <Construction size={22} className="text-amber-500" />
        This page is coming in a later step.
      </div>
    </div>
  );
}
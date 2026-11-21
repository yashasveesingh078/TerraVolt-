import { useAuth } from '../context/AuthContext.jsx';

export default function Dashboard() {
  const { user } = useAuth();
  return (
    <div className="space-y-2">
      <h1 className="text-2xl font-semibold text-slate-800 dark:text-slate-100">Welcome, {user.name}</h1>
      <p className="text-slate-500 dark:text-slate-400">
        Profit per job, money to collect and today's work will appear here in Step 15.
      </p>
    </div>
  );
}
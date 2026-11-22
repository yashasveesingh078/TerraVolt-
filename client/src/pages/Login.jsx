import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Sun, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { homePath } from '../config/navigation.js';
import ThemeToggle from '../components/ThemeToggle.jsx';

const demoAccounts = [
  { label: 'Director', email: 'director@terravolt.test' },
  { label: 'Sales', email: 'sales@terravolt.test' },
  { label: 'Warehouse', email: 'warehouse@terravolt.test' },
  { label: 'Technician', email: 'ravi@terravolt.test' },
  { label: 'Service', email: 'service@terravolt.test' },
  { label: 'Accounts', email: 'accounts@terravolt.test' },
];

const inputClass =
  'w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-400';

export default function Login() {
  const { user, loading, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (loading) return null;
  if (user) return <Navigate to={homePath(user.role)} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      const wantedPage = location.state?.from?.pathname;
      navigate(wantedPage || homePath(loggedIn.role), { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  function fillDemo(demoEmail) {
    setEmail(demoEmail);
    setPassword('terravolt123');
    setError('');
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-950 px-4">
      <div className="absolute top-4 right-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-sm">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Sun className="text-amber-500" size={32} />
          <h1 className="text-2xl font-bold text-slate-800 dark:text-slate-100">TerraVolt</h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 space-y-4"
        >
          <h2 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Staff login</h2>

          {error && (
            <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1">
            <label htmlFor="email" className="text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input id="email" type="email" required value={email}
              onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          </div>

          <div className="space-y-1">
            <label htmlFor="password" className="text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input id="password" type="password" required value={password}
              onChange={(e) => setPassword(e.target.value)} className={inputClass} />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-amber-500 hover:bg-amber-600 disabled:opacity-60 text-slate-900 font-medium py-2"
          >
            <LogIn size={18} />
            {submitting ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="mt-5">
          <p className="text-xs text-slate-500 dark:text-slate-400 text-center mb-2">
            Demo accounts (password filled automatically)
          </p>
          <div className="grid grid-cols-3 gap-2">
            {demoAccounts.map((a) => (
              <button
                key={a.email}
                type="button"
                onClick={() => fillDemo(a.email)}
                className="text-xs rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200 py-1.5 hover:bg-amber-50 dark:hover:bg-slate-800"
              >
                {a.label}
              </button>
            ))}
          </div>
        </div>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Customer?{' '}
          <Link to="/enquiry" className="font-medium text-amber-600 hover:underline">
            Get a free solar estimate
          </Link>
        </p>
      </div>
    </div>
  );
}
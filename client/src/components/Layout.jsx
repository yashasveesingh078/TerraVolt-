import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Sun, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { navForRole, roleLabels } from '../config/navigation.js';
import ThemeToggle from './ThemeToggle.jsx';

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = navForRole(user.role);

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 md:flex">
      {/* ---------- Sidebar (dark in both themes) ---------- */}
      <aside
        className={`${menuOpen ? 'block' : 'hidden'} md:block w-full md:w-60 shrink-0 bg-slate-900 text-slate-300 md:min-h-screen md:border-r md:border-slate-800`}
      >
        <div className="flex items-center gap-2 px-5 py-5 border-b border-slate-800">
          <Sun className="text-amber-400" size={24} />
          <span className="text-lg font-semibold text-white">TerraVolt</span>
        </div>

        <nav className="p-3 space-y-1">
          {items.map(({ path, label, icon: Icon }) => (
            <NavLink
              key={path}
              to={path}
              onClick={() => setMenuOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                  isActive
                    ? 'bg-amber-500 text-slate-900 font-medium'
                    : 'hover:bg-slate-800 hover:text-white'
                }`
              }
            >
              <Icon size={18} />
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* ---------- Main area ---------- */}
      <div className="flex-1 min-w-0">
        <header className="flex items-center gap-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-4 md:px-6 py-3">
          <button
            className="md:hidden p-1 text-slate-600 dark:text-slate-300"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X size={22} /> : <Menu size={22} />}
          </button>

          <div className="ml-auto flex items-center gap-3">
            <div className="text-right leading-tight">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{user.name}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{roleLabels[user.role]}</p>
            </div>

            <ThemeToggle />

            <button
              onClick={handleLogout}
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <LogOut size={16} />
              Log out
            </button>
          </div>
        </header>

        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
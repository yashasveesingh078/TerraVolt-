import { useState } from 'react';
import { Moon, Sun } from 'lucide-react';

// Reads the theme the index.html script already applied
function currentTheme() {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

export default function ThemeToggle() {
  const [theme, setTheme] = useState(currentTheme);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.toggle('dark', next === 'dark');
    try {
      localStorage.setItem('theme', next); // remember the choice
    } catch {
      // storage blocked: the theme still changes, it just won't be remembered
    }
    setTheme(next);
  }

  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      title={isDark ? 'Light theme' : 'Dark theme'}
      className="rounded-lg border border-slate-200 dark:border-slate-700 p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
    >
      {isDark ? <Sun size={16} /> : <Moon size={16} />}
    </button>
  );
}
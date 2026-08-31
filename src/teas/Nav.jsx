import { Link, useLocation } from 'react-router-dom';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from './theme.js';
import { Brand } from './Brand.jsx';
import { RepoLinks } from './RepoLinks.jsx';

// Shared navigation with an active-route marker.
const ITEMS = [
  ['/', 'Explore'],
  ['/insights', 'Insights'],
  ['/methods', 'Methods'],
  ['/publications', 'Publications'],
  ['/team', 'Team'],
  ['/contact', 'Contact'],
];

// Preserve custom pricing stored in the query string across every route.
const CARRIES_SEARCH = new Set(['/', '/insights', '/methods', '/publications', '/team', '/contact']);

export function Nav() {
  const [theme, toggleTheme] = useTheme();
  const { pathname, search } = useLocation();
  return (
    <nav className="bg-white/85 dark:bg-slate-900/85 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-40 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-x-4 gap-y-2 flex-wrap">
        <Brand expansion={false} />
        <div className="flex flex-wrap gap-1">
          {ITEMS.map(([to, label]) => {
            const active = pathname === to;
            return (
              <Link key={to} to={CARRIES_SEARCH.has(to) ? { pathname: to, search } : to}
                className={'px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors ' + (active
                  ? 'bg-amber-500 text-slate-900 dark:text-slate-100'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100')}>{label}</Link>
            );
          })}
        </div>
        <div className="ml-auto flex items-center gap-3">
          <RepoLinks />
          <button onClick={toggleTheme} aria-label="Toggle light or dark theme" title="Toggle light or dark theme"
            className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-teal-500 transition-colors">
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </nav>
  );
}

import { useId } from 'react';
import { Link, useLocation } from 'react-router-dom';

// The tasting-flight mark also reads as a bar chart. Glassware follows the current text colour.
// Keep graduation ticks on x = cx - 11 + (y - 16) * 0.1143. Liquid ellipses use ry = 0.32 rx.
export function Mark({ className = '', label = 'TEAS' }) {
  // Keep gradient IDs unique when several marks share a page.
  const uid = useId().replace(/:/g, '');
  const g = (n) => `teas-${n}-${uid}`;
  return (
    <svg viewBox="0 0 96 64" className={className} role="img" aria-label={label}>
      <defs>
        <linearGradient id={g('green')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#B9CB5E" /><stop offset="1" stopColor="#8A9C34" />
        </linearGradient>
        <linearGradient id={g('oolong')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#DD9438" /><stop offset="1" stopColor="#B36A18" />
        </linearGradient>
        <linearGradient id={g('black')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9C4522" /><stop offset="1" stopColor="#6E2C12" />
        </linearGradient>
      </defs>

      {/* green · lowest fill */}
      <path d="M13.29 36 L14.2 44 Q14.4 47 17.4 47 L26.6 47 Q29.6 47 29.8 44 L30.71 36 Z" fill={`url(#${g('green')})`} />
      <ellipse cx="22" cy="36" rx="8.71" ry="2.85" fill="#C7D77A" />
      <path d="M28.3 39.5 L27.4 44" fill="none" stroke="#ffffff" strokeOpacity=".22" strokeWidth="2.2" strokeLinecap="round" />

      {/* oolong · middle fill */}
      <path d="M40.37 28 L42.2 44 Q42.4 47 45.4 47 L54.6 47 Q57.6 47 57.8 44 L59.63 28 Z" fill={`url(#${g('oolong')})`} />
      <ellipse cx="50" cy="28" rx="9.63" ry="3.15" fill="#EBAC63" />
      <path d="M55.8 32 L54.6 44" fill="none" stroke="#ffffff" strokeOpacity=".22" strokeWidth="2.2" strokeLinecap="round" />

      {/* black · highest fill */}
      <path d="M67.46 20 L70.2 44 Q70.4 47 73.4 47 L82.6 47 Q85.6 47 85.8 44 L88.54 20 Z" fill={`url(#${g('black')})`} />
      <ellipse cx="78" cy="20" rx="10.54" ry="3.45" fill="#B15A33" />
      <path d="M83.9 24.5 L82.5 44" fill="none" stroke="#ffffff" strokeOpacity=".2" strokeWidth="2.2" strokeLinecap="round" />

      {/* Shared measurement scale */}
      <g fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" opacity=".8">
        <path d="M11.46 20h4" /><path d="M12.37 28h4" /><path d="M13.29 36h4" />
        <path d="M39.46 20h4" /><path d="M40.37 28h4" /><path d="M41.29 36h4" />
        <path d="M67.46 20h4" /><path d="M68.37 28h4" /><path d="M69.29 36h4" />
      </g>

      {/* Glassware sits above the liquid. */}
      <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round">
        <path d="M11 16 L14.2 44 Q14.4 47 17.4 47 L26.6 47 Q29.6 47 29.8 44 L33 16" />
        <path d="M39 16 L42.2 44 Q42.4 47 45.4 47 L54.6 47 Q57.6 47 57.8 44 L61 16" />
        <path d="M67 16 L70.2 44 Q70.4 47 73.4 47 L82.6 47 Q85.6 47 85.8 44 L89 16" />
      </g>
      <g fill="none" stroke="currentColor" strokeWidth="2.6">
        <ellipse cx="22" cy="16" rx="11" ry="3.6" />
        <ellipse cx="50" cy="16" rx="11" ry="3.6" />
        <ellipse cx="78" cy="16" rx="11" ry="3.6" />
      </g>
      <path d="M7 53h86" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
    </svg>
  );
}

// Percentage positions keep the ticks aligned as the wordmark width changes.
const Tick = ({ at }) => (
  <i className="absolute top-0 w-px h-[5px] bg-teal-700 dark:bg-teal-300" style={{ left: at }} aria-hidden="true" />
);

/** Sitewide masthead linking to the dashboard. */
export function Brand({ expansion = true }) {
  // Preserve custom pricing stored in the query string.
  const { search } = useLocation();
  return (
    <Link to={{ pathname: '/', search }} aria-label="TEAS — home"
      className="flex items-center gap-2.5 rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent">
      <Mark className="h-9 w-[54px] shrink-0 text-teal-700 dark:text-teal-300" label="" />
      <span className="grid gap-[2px]">
        <span className="font-serif text-2xl font-semibold leading-none tracking-[0.2em] text-slate-900 dark:text-slate-100">TEAS</span>
        <span className="relative block h-[5px] border-t border-teal-700/90 dark:border-teal-300/90" aria-hidden="true">
          <Tick at="22%" /><Tick at="68%" />
        </span>
        {expansion && (
          <span className="hidden sm:block font-mono text-[10px] uppercase leading-none tracking-[0.12em] text-slate-500 dark:text-slate-400">
            Tracking Evolving AI and Systems
          </span>
        )}
      </span>
    </Link>
  );
}

// Sitewide institutional and funder credit, rendered by every page so the
// acknowledgement appears wherever a visitor lands.

const LINK = 'text-blue-600 dark:text-blue-400 hover:underline';

export function Footer() {
  return (
    <footer className="border-t border-slate-200 dark:border-slate-800 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          Built by teams at the <a href="https://www.ed.ac.uk/" target="_blank" rel="noopener noreferrer" className={LINK}>University of Edinburgh</a>, <a href="https://www.epcc.ed.ac.uk/" target="_blank" rel="noopener noreferrer" className={LINK}>EPCC</a> and <a href="https://www.imperial.ac.uk/" target="_blank" rel="noopener noreferrer" className={LINK}>Imperial College London</a>, funded by <a href="https://www.aria.org.uk" target="_blank" rel="noopener noreferrer" className={LINK}>ARIA</a> under the <a href="https://www.aria.org.uk/opportunity-spaces/nature-computes-better/scaling-compute/" target="_blank" rel="noopener noreferrer" className={LINK}>&ldquo;Scaling compute&rdquo;</a> programme.
        </p>
      </div>
    </footer>
  );
}

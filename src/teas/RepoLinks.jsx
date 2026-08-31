import { Github, Download } from 'lucide-react';

// Links to the benchmark source and generated dashboard data.
const REPO = 'https://github.com/TEAS-project/TEASBench';
const DATA = [
  ['db.json', 'Benchmarks'],
  ['figs.json', 'Analysis figures'],
  ['turns.json', 'Per-turn series'],
];

const ICO = 'p-1.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 hover:border-teal-500 transition-colors';

// GitHub link + a native-<details> dropdown to download the raw JSON.
export function RepoLinks() {
  return (
    <>
      <a href={REPO} target="_blank" rel="noopener noreferrer" aria-label="Source code on GitHub" title="Source code on GitHub" className={ICO}>
        <Github className="w-4 h-4" />
      </a>
      <details className="relative">
        <summary aria-label="Download raw data" title="Download raw data" className={ICO + ' inline-flex cursor-pointer list-none [&::-webkit-details-marker]:hidden'}>
          <Download className="w-4 h-4" />
        </summary>
        <div className="absolute right-0 mt-2 w-60 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-lg shadow-lg p-1 z-50">
          <div className="px-3 py-1.5 text-xs text-slate-400 dark:text-slate-500">Raw data · JSON</div>
          {DATA.map(([file, label]) => (
            <a key={file} href={`/data/${file}`} download className="block whitespace-nowrap px-3 py-1.5 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800">
              <span className="text-sm text-slate-700 dark:text-slate-200">{label}</span>
              <span className="ml-1.5 text-xs text-slate-400 dark:text-slate-500 font-mono">{file}</span>
            </a>
          ))}
        </div>
      </details>
    </>
  );
}

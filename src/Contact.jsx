import { Nav } from './teas/Nav.jsx';
import { Footer } from './teas/Footer.jsx';

const MAIL = 'font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline underline-offset-2 transition-colors';

// Contact routes by topic.
const ROUTES = [
  ['Info', 'teas-bench-info@mlist.is.ed.ac.uk',
    'General questions about the benchmark, its scope, or how to read a result.'],
  ['Contribution', 'teas-bench-contribute@mlist.is.ed.ac.uk',
    'Offers to contribute hardware, engine configurations, workloads or measurements.'],
  ['Report', 'teas-bench-report@mlist.is.ed.ac.uk',
    'Problems with the benchmark or with published data, such as a wrong configuration, price, precision label, or hardware spec. Send the evidence with it.'],
];

export default function Contact() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      <Nav />

      {/* Hero */}
      <div className="bg-gradient-to-b from-white dark:from-slate-800 to-slate-50 dark:to-slate-900 py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100" style={{ lineHeight: 1.2 }}>Contact</h1>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            TEAS is maintained as a live benchmark, so corrections and contributions are very welcome.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-12">
        <article className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-lg p-8">
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-6">Getting in touch</h2>
          <dl className="space-y-6">
            {ROUTES.map(([label, address, purpose]) => (
              <div key={address}>
                <dt className="text-sm font-semibold text-slate-800 dark:text-slate-200 mb-1">{label}</dt>
                <dd className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  {purpose}{' '}
                  <a href={`mailto:${address}`} className={MAIL}>{address}</a>
                </dd>
              </div>
            ))}
          </dl>
        </article>
      </div>

      <Footer />
    </div>
  );
}

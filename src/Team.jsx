import { Nav } from './teas/Nav.jsx';
import { Footer } from './teas/Footer.jsx';

export default function Team() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100">
      {/* Navigation Bar */}
      <Nav />

      {/* Hero */}
      <div className="bg-gradient-to-b from-white dark:from-slate-800 to-slate-50 dark:to-slate-900 py-14 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-bold mb-4 text-slate-900 dark:text-slate-100" style={{ lineHeight: 1.2 }}>Team</h1>
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            TEAS is run by researchers at the University of Edinburgh, EPCC and Imperial College London.
            The team designs workloads, operates hardware, audits measurements and maintains the code and data pipelines.
          </p>
        </div>
      </div>

      {/* Team Content */}
      <div className="max-w-7xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Investigators */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-lg p-8">
            <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-6 pl-2 border-l-4 border-blue-500">Investigators</h2>
            <ul className="space-y-4">
            <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Edoardo Ponti</span>
                <span className="text-slate-500 dark:text-slate-400">University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Nick Brown</span>
                <span className="text-slate-500 dark:text-slate-400">EPCC - University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Adrian Jackson</span>
                <span className="text-slate-500 dark:text-slate-400">EPCC - University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Boris Grot</span>
                <span className="text-slate-500 dark:text-slate-400">University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Wenda Li</span>
                <span className="text-slate-500 dark:text-slate-400">University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Luo Mai</span>
                <span className="text-slate-500 dark:text-slate-400">University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Aaron Zhao</span>
                <span className="text-slate-500 dark:text-slate-400">Imperial College London</span>
              </li>
            </ul>
          </div>

          {/* Project Team */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-lg p-8">
            <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-6 pl-2 border-l-4 border-blue-500">Contributors</h2>
            <ul className="space-y-4">
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Arno Proeme</span>
                <span className="text-slate-500 dark:text-slate-400">EPCC - University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">James Richings</span>
                <span className="text-slate-500 dark:text-slate-400">EPCC - University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Mark Klaisoongnoen</span>
                <span className="text-slate-500 dark:text-slate-400">EPCC - University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Yinsicheng Jiang</span>
                <span className="text-slate-500 dark:text-slate-400">University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Yufan Zhao</span>
                <span className="text-slate-500 dark:text-slate-400">University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Liang Cheng</span>
                <span className="text-slate-500 dark:text-slate-400">University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">William Lucas</span>
                <span className="text-slate-500 dark:text-slate-400">EPCC - University of Edinburgh</span>
              </li>
              <li className="flex flex-col">
                <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Daniyal Arshad</span>
                <span className="text-slate-500 dark:text-slate-400">EPCC - University of Edinburgh</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Advisors */}
        <div className="mt-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none rounded-lg p-8">
          <h2 className="text-xl font-bold text-blue-600 dark:text-blue-400 mb-6 pl-2 border-l-4 border-blue-500">Advisors</h2>
          <ul className="space-y-4">
            <li className="flex flex-col">
              <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg">Stylianos Venieris</span>
              <span className="text-slate-500 dark:text-slate-400">Samsung AI Center, Cambridge</span>
            </li>
          </ul>
        </div>

        {/* Institutions */}
        <div className="mt-12 bg-white/30 border border-slate-200 dark:border-slate-800 rounded-lg p-8 text-center">
          <h3 className="text-lg font-semibold text-slate-600 dark:text-slate-300 mb-4">Partner Institutions</h3>
          <div className="flex flex-wrap justify-center gap-8 text-slate-500 dark:text-slate-400">
            <a href="https://www.ed.ac.uk/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">University of Edinburgh</a>
            <a href="https://www.epcc.ed.ac.uk/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">EPCC</a>
            <a href="https://www.imperial.ac.uk/" target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 dark:hover:text-blue-300 transition-colors">Imperial College London</a>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}

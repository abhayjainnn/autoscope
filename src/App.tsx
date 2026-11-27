import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Building2, Briefcase, Workflow, Video, Activity, Target, Cpu, PiggyBank, Map, MessageSquare, FileText, SlidersHorizontal, LayoutDashboard,
} from 'lucide-react';
import Logo from './components/Logo';
import Landing from './pages/Landing';
import Overview from './pages/Overview';
import Profile from './pages/Profile';
import LineBuilder from './pages/LineBuilder';
import Capture from './pages/Capture';
import Analysis from './pages/Analysis';
import Opportunities from './pages/Opportunities';
import Technology from './pages/Technology';
import Roi from './pages/Roi';
import Roadmap from './pages/Roadmap';
import Advisor from './pages/Advisor';
import Report from './pages/Report';
import AssumptionsPage from './pages/Assumptions';
import Questionnaire from './pages/Questionnaire';
import Office from './pages/Office';
import { useApp } from './store';

const NAV: { group: string; items: { to: string; label: string; icon: typeof Building2 }[] }[] = [
  { group: 'Start', items: [{ to: '/app', label: 'Overview', icon: LayoutDashboard }] },
  {
    group: '1 · Capture',
    items: [
      { to: '/profile', label: 'Company profile', icon: Building2 },
      { to: '/line', label: 'Line Builder', icon: Workflow },
      { to: '/capture', label: 'AI Process Capture', icon: Video },
    ],
  },
  {
    group: '2 · What',
    items: [
      { to: '/analysis', label: 'Line Analysis', icon: Activity },
      { to: '/opportunities', label: 'Opportunities', icon: Target },
      { to: '/office', label: 'Office & admin', icon: Briefcase },
    ],
  },
  { group: '3 · How', items: [{ to: '/technology', label: 'Technology', icon: Cpu }] },
  {
    group: '4 · Does it pay off',
    items: [
      { to: '/roi', label: 'ROI & Risk', icon: PiggyBank },
      { to: '/roadmap', label: 'Roadmap', icon: Map },
    ],
  },
  {
    group: 'Act',
    items: [
      { to: '/advisor', label: 'AI Advisor', icon: MessageSquare },
      { to: '/report', label: 'Report', icon: FileText },
      { to: '/assumptions', label: 'Assumptions', icon: SlidersHorizontal },
    ],
  },
];

function Sidebar() {
  const name = useApp((s) => s.profile.name);
  return (
    <aside className="no-print sticky top-0 hidden h-screen w-72 shrink-0 flex-col border-r border-ink-200/70 bg-gradient-to-b from-white to-ink-50 lg:flex">
      <NavLink to="/" className="flex items-center px-6 pb-5 pt-6 transition hover:opacity-90">
        <Logo size={44} />
      </NavLink>
      <div className="mx-4 mb-1 flex items-center gap-2.5 rounded-xl border border-ink-200/70 bg-white px-3 py-2.5 shadow-sm" title={name}>
        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-sand-100 text-sand-700"><Building2 size={16} /></span>
        <span className="min-w-0">
          <span className="block text-[10px] font-semibold uppercase tracking-wider text-ink-400">Company</span>
          <span className="block truncate text-sm font-semibold text-ink-800">{name}</span>
        </span>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV.map((g) => (
          <div key={g.group} className="mt-5">
            <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-[0.16em] text-ink-400">{g.group}</div>
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `group relative mt-0.5 flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-800 shadow-sm ring-1 ring-brand-100' : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900'}`
                }
              >
                {({ isActive }) => (
                  <>
                    <span className={`absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600 transition-opacity ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                    <it.icon size={17} className={isActive ? 'text-brand-600' : 'text-ink-400 group-hover:text-ink-600'} />
                    {it.label}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      <div className="border-t border-ink-200/70 px-6 py-4 text-[11px] text-ink-400">Indicative ranges · validate with integrator quotes</div>
    </aside>
  );
}

function MobileNav() {
  return (
    <div className="no-print sticky top-0 z-20 border-b border-ink-200/70 bg-ink-50/90 backdrop-blur-lg lg:hidden">
      <div className="px-4 pt-3">
        <NavLink to="/" className="inline-flex"><Logo size={34} tagline={false} /></NavLink>
      </div>
      <div className="flex gap-1.5 overflow-x-auto px-3 py-2.5">
        {NAV.flatMap((g) => g.items).map((it) => (
          <NavLink
            key={it.to}
            to={it.to}
            className={({ isActive }) => `inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition ${isActive ? 'bg-brand-600 text-white shadow-sm' : 'bg-white text-ink-600 ring-1 ring-ink-200/70'}`}
          >
            <it.icon size={13} />
            {it.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  if (pathname === '/') return <Landing />;
  if (pathname === '/questionnaire') return <Questionnaire />;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <main className="print-full mx-auto w-full min-w-0 max-w-7xl px-4 py-5 md:px-8 md:py-8">
          <Routes>
            <Route path="/app" element={<Overview />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/line" element={<LineBuilder />} />
            <Route path="/capture" element={<Capture />} />
            <Route path="/analysis" element={<Analysis />} />
            <Route path="/opportunities" element={<Opportunities />} />
            <Route path="/technology" element={<Technology />} />
            <Route path="/roi" element={<Roi />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/advisor" element={<Advisor />} />
            <Route path="/report" element={<Report />} />
            <Route path="/assumptions" element={<AssumptionsPage />} />
            <Route path="/office" element={<Office />} />
            <Route path="*" element={<Overview />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

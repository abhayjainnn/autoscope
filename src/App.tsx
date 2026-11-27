import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import {
  Building2, Workflow, Video, Activity, Target, Cpu, PiggyBank, Map, MessageSquare, FileText, SlidersHorizontal, LayoutDashboard, ScanSearch,
} from 'lucide-react';
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
    <aside className="no-print sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-ink-100 bg-white lg:flex">
      <NavLink to="/" className="flex items-center gap-2 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow">
          <ScanSearch size={18} />
        </div>
        <div>
          <div className="text-base font-extrabold tracking-tight">AutoScope</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-ink-400">Vendor-neutral advisor</div>
        </div>
      </NavLink>
      <div className="mx-4 mb-2 truncate rounded-lg bg-ink-50 px-3 py-2 text-xs text-ink-600" title={name}>
        <span className="text-ink-400">Company · </span>
        {name}
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6">
        {NAV.map((g) => (
          <div key={g.group} className="mt-4">
            <div className="px-2 text-[10px] font-semibold uppercase tracking-wider text-ink-400">{g.group}</div>
            {g.items.map((it) => (
              <NavLink
                key={it.to}
                to={it.to}
                className={({ isActive }) =>
                  `mt-0.5 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600 hover:bg-ink-50'}`
                }
              >
                <it.icon size={16} />
                {it.label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}

function MobileNav() {
  return (
    <div className="no-print sticky top-0 z-20 flex gap-1 overflow-x-auto border-b border-ink-100 bg-white px-3 py-2 lg:hidden">
      {NAV.flatMap((g) => g.items).map((it) => (
        <NavLink key={it.to} to={it.to} className={({ isActive }) => `shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium ${isActive ? 'bg-brand-50 text-brand-700' : 'text-ink-600'}`}>
          {it.label}
        </NavLink>
      ))}
    </div>
  );
}

export default function App() {
  const { pathname } = useLocation();
  if (pathname === '/') return <Landing />;
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="min-w-0 flex-1">
        <MobileNav />
        <main className="print-full mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">
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
            <Route path="*" element={<Overview />} />
          </Routes>
        </main>
      </div>
    </div>
  );
}

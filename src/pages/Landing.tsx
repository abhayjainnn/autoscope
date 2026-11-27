import { useNavigate } from 'react-router-dom';
import { ArrowRight, ScanSearch, Target, Cpu, PiggyBank, ShieldCheck, Video, Scale, Eye } from 'lucide-react';
import { useApp } from '../store';

export default function Landing() {
  const nav = useNavigate();
  const loadDemo = useApp((s) => s.loadDemo);

  return (
    <div className="min-h-screen bg-white">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-5 md:px-8">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow"><ScanSearch size={18} /></div>
          <span className="text-lg font-extrabold tracking-tight">AutoScope</span>
        </div>
        <button onClick={() => nav('/app')} className="text-sm font-semibold text-brand-700 hover:underline">Open app →</button>
      </header>

      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,var(--color-brand-100),transparent_60%)]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-10 md:px-8 md:pt-16">
          <div className="inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white px-3 py-1 text-xs font-semibold text-brand-700">
            <ShieldCheck size={14} /> Vendor-neutral · Built for food & beverage packaging
          </div>
          <h1 className="mt-5 max-w-4xl text-4xl font-extrabold leading-[1.05] tracking-tight text-ink-900 md:text-6xl">
            Know what to automate <span className="bg-gradient-to-r from-brand-600 to-brand-400 bg-clip-text text-transparent">before you spend half a million</span> on it.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-600">
            AutoScope is the automation expert most Mittelstand food producers don't have. Film your packaging line, and in minutes get an unbiased answer:
            what's worth automating, which technology fits, and whether it pays off.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <button onClick={() => { loadDemo(); nav('/app'); }} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-3 text-base font-semibold text-white shadow-lg shadow-brand-600/20 hover:bg-brand-700">
              See the live demo <ArrowRight size={18} />
            </button>
            <button onClick={() => nav('/capture')} className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-base font-semibold text-ink-800 ring-1 ring-ink-200 hover:bg-ink-50">
              <Video size={18} /> Analyse my line from a video
            </button>
          </div>
          <div className="mt-4 text-xs text-ink-400">Demo: Brunnenhof Getränke GmbH, a fictional 85-person mineral water bottler.</div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-12 md:px-8">
        <div className="grid gap-5 md:grid-cols-3">
          {[
            { icon: Target, n: '1', t: 'What', d: 'Scores every station on labour, repetitiveness, ergonomics, quality, bottleneck and stability, and shows the reasons behind each score.' },
            { icon: Cpu, n: '2', t: 'How', d: 'Matches each task to a technology class (software, conveyor, special machine, cobot, robot, AGV, inspection) and explains why the alternatives lost.' },
            { icon: PiggyBank, n: '3', t: 'Does it pay off', d: 'Investment, savings, payback, NPV and risk, plus the probability of paying back in 1,000 simulated futures. A ranged answer you can trust.' },
          ].map((c) => (
            <div key={c.t} className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-50 text-brand-600"><c.icon size={20} /></div>
                <div className="text-xs font-bold uppercase tracking-wider text-ink-400">Question {c.n}</div>
              </div>
              <h3 className="mt-4 text-xl font-bold">{c.t}</h3>
              <p className="mt-2 text-sm text-ink-600">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-ink-900 py-14 text-white">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 md:grid-cols-3 md:px-8">
          {[
            { icon: Scale, t: 'No vendor bias', d: 'We recommend technology classes, never brands. No vendor pays for a result.' },
            { icon: Eye, t: 'No black box', d: 'Every score and euro figure comes from visible rules and assumptions you can edit.' },
            { icon: ShieldCheck, t: 'Your data stays yours', d: 'No account needed. Your line data stays in your browser.' },
          ].map((c) => (
            <div key={c.t}>
              <c.icon className="text-brand-300" />
              <h3 className="mt-3 text-lg font-bold">{c.t}</h3>
              <p className="mt-1 text-sm text-ink-300">{c.d}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-ink-400 md:px-8">AutoScope · Hackathon prototype · Cost ranges are indicative; validate with integrator quotes.</footer>
    </div>
  );
}

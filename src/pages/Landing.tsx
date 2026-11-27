import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight, Target, Cpu, PiggyBank, ShieldCheck, Video, Scale, Eye, ClipboardList, Workflow, Activity, Sparkles,
  CheckCircle2, Zap, Wrench, XCircle, Briefcase, Users, Euro, Store, Play, ChevronRight,
} from 'lucide-react';
import { useApp } from '../store';
import Logo from '../components/Logo';
import { Reveal, useInView } from '../hooks/useReveal';

const LANDING_CSS = `
@keyframes as-belt { from { transform: translateX(0); } to { transform: translateX(-60px); } }
@keyframes as-item { from { transform: translateX(-60px); } to { transform: translateX(520px); } }
@keyframes as-pulse { 0%,100% { opacity: .35; } 50% { opacity: .9; } }
@keyframes as-scan { 0%,100% { transform: translateY(0); } 50% { transform: translateY(46px); } }
.as-belt { animation: as-belt 1.6s linear infinite; }
.as-item { animation: as-item 9s linear infinite; }
.as-pulse { animation: as-pulse 1.8s ease-in-out infinite; }
.as-scan { animation: as-scan 2.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .as-belt, .as-item, .as-pulse, .as-scan, .animate-float { animation: none !important; } }
`;

function CountUp({ to, decimals = 0, prefix = '', suffix = '', duration = 1400 }: { to: number; decimals?: number; prefix?: string; suffix?: string; duration?: number }) {
  const [ref, visible] = useInView<HTMLSpanElement>(0.4);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!visible) return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setV(to); return; }
    let raf = 0;
    const start = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setV(to * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [visible, to, duration]);
  return <span ref={ref} className="tabular-nums">{prefix}{v.toFixed(decimals)}{suffix}</span>;
}

function HeroVisual() {
  const stations = [
    { x: 40, label: 'Depal' },
    { x: 150, label: 'Filler' },
    { x: 260, label: 'Labeller', bottleneck: true },
    { x: 370, label: 'Case packer' },
  ];
  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div className="absolute -inset-6 rounded-[2.5rem] bg-gradient-to-br from-brand-100 via-sand-100 to-transparent blur-2xl" />
      <div className="relative overflow-hidden rounded-3xl border border-ink-200/70 bg-white/80 p-4 shadow-2xl shadow-brand-900/10 backdrop-blur sm:p-6">
        <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-ink-400">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-brand-500 as-pulse" /> Line 1 · PET 1.0 L</span>
          <span>Live analysis</span>
        </div>
        <svg viewBox="0 0 480 220" className="mt-3 w-full" role="img" aria-label="Animated packaging line with the labeller highlighted as bottleneck">
          <defs>
            <clipPath id="as-belt-clip"><rect x="0" y="150" width="480" height="18" rx="9" /></clipPath>
            <clipPath id="as-line-clip"><rect x="0" y="0" width="480" height="220" /></clipPath>
          </defs>
          {/* stations */}
          {stations.map((s) => (
            <g key={s.label}>
              {s.bottleneck && <rect x={s.x - 10} y={30} width={90} height={136} rx={14} fill="#c3974b" opacity="0.18" className="as-pulse" />}
              <rect x={s.x} y={58} width={70} height={84} rx={10} fill={s.bottleneck ? '#fdfaf3' : '#faf7f0'} stroke={s.bottleneck ? '#c3974b' : '#cdc4ae'} strokeWidth={s.bottleneck ? 2.5 : 1.5} />
              <rect x={s.x + 12} y={70} width={46} height={8} rx={4} fill={s.bottleneck ? '#e2c992' : '#e3dccb'} />
              <rect x={s.x + 12} y={84} width={30} height={6} rx={3} fill="#e3dccb" />
              <text x={s.x + 35} y={50} textAnchor="middle" fontSize="11" fontWeight="600" fill={s.bottleneck ? '#845e2e' : '#7d7563'}>{s.label}</text>
            </g>
          ))}
          {/* scan line over bottleneck */}
          <g className="as-scan"><rect x={256} y={62} width={78} height={2} rx={1} fill="#7d8b3f" opacity="0.8" /></g>
          {/* belt */}
          <rect x="0" y="150" width="480" height="18" rx="9" fill="#474237" />
          <g clipPath="url(#as-belt-clip)">
            <g className="as-belt">
              {Array.from({ length: 12 }).map((_, i) => <rect key={i} x={i * 60} y={157} width={30} height={4} rx={2} fill="#7d7563" />)}
            </g>
          </g>
          {/* moving bottles */}
          <g clipPath="url(#as-line-clip)">
            {Array.from({ length: 6 }).map((_, i) => (
              <g key={i} className="as-item" style={{ animationDelay: `${-i * 1.5}s` }}>
                <path d="M6 112h6v6c0 1 1 2 2 3 2 2 3 3 3 6v23H1v-23c0-3 1-4 3-6 1-1 2-2 2-3z" fill="#9aa75a" stroke="#4d5727" strokeWidth="1" opacity="0.9" />
                <rect x="1" y="132" width="16" height="7" fill="#f7efdc" />
              </g>
            ))}
          </g>
          <text x="295" y="200" textAnchor="middle" fontSize="11" fontWeight="700" fill="#a67a38">Bottleneck</text>
        </svg>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-[11px] text-ink-500">
          <div className="rounded-xl bg-ink-50 py-2"><div className="font-display text-base font-semibold text-ink-900">840</div>cases / h target</div>
          <div className="rounded-xl bg-ink-50 py-2"><div className="font-display text-base font-semibold text-ink-900">5</div>manual stations</div>
          <div className="rounded-xl bg-ink-50 py-2"><div className="font-display text-base font-semibold text-ink-900">2</div>shifts</div>
        </div>
      </div>
      {/* floating KPI cards */}
      <div className="animate-float absolute -left-2 -top-5 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-xl shadow-brand-900/10 sm:-left-8">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">Payback</div>
        <div className="font-display text-xl font-semibold text-brand-700">1.1 yrs</div>
      </div>
      <div className="animate-float absolute -right-2 top-1/3 rounded-2xl border border-ink-100 bg-white px-4 py-3 shadow-xl shadow-brand-900/10 sm:-right-8" style={{ animationDelay: '-2s' }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-ink-400">OEE</div>
        <div className="font-display text-xl font-semibold text-ink-900">70%</div>
      </div>
      <div className="animate-float absolute -bottom-5 left-8 rounded-2xl bg-brand-900 px-4 py-3 text-white shadow-xl shadow-brand-900/30" style={{ animationDelay: '-4s' }}>
        <div className="text-[10px] font-semibold uppercase tracking-wider text-brand-200">Jobs relieved</div>
        <div className="font-display text-xl font-semibold">4.7 FTE</div>
      </div>
    </div>
  );
}

function SectionHead({ eyebrow, title, sub, center = true }: { eyebrow: string; title: string; sub?: string; center?: boolean }) {
  return (
    <Reveal className={center ? 'mx-auto max-w-2xl text-center' : 'max-w-2xl'}>
      <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">{eyebrow}</div>
      <h2 className="mt-3 text-3xl font-semibold leading-tight text-ink-900 md:text-[2.75rem]">{title}</h2>
      {sub && <p className="mt-4 text-base text-ink-600 md:text-lg">{sub}</p>}
    </Reveal>
  );
}

export default function Landing() {
  const nav = useNavigate();
  const loadDemo = useApp((s) => s.loadDemo);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 12);
    on();
    window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const demo = () => { loadDemo(); nav('/app'); };

  return (
    <div className="min-h-screen overflow-x-hidden bg-ink-50 text-ink-900">
      <style>{LANDING_CSS}</style>

      {/* Header */}
      <header className={`sticky top-0 z-40 transition-all duration-300 ${scrolled ? 'border-b border-ink-200/70 bg-ink-50/80 shadow-sm backdrop-blur-lg' : 'border-b border-transparent'}`}>
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 md:px-8 md:py-4">
          <a href="#top" aria-label="AutoScope home"><Logo size={44} tagline={false} className="sm:hidden" /><Logo size={48} className="hidden sm:inline-flex" /></a>
          <nav className="hidden items-center gap-8 text-sm font-medium text-ink-600 md:flex">
            <a href="#how" className="transition hover:text-brand-700">How it works</a>
            <a href="#features" className="transition hover:text-brand-700">Features</a>
            <a href="#trust" className="transition hover:text-brand-700">Trust</a>
          </nav>
          <button onClick={() => nav('/app')} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-ink-900 px-4 py-2 text-sm font-semibold text-ink-50 transition hover:bg-brand-800">
            Open app <ArrowRight size={15} />
          </button>
        </div>
      </header>

      {/* Hero */}
      <section id="top" className="relative -mt-[76px] pt-[76px]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_80%_0%,var(--color-brand-100),transparent_70%),radial-gradient(40rem_30rem_at_0%_30%,var(--color-sand-100),transparent_70%)]" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 pb-20 pt-10 md:px-8 md:pt-16 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
          <div>
            <div className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1.5 text-xs font-semibold text-brand-700 shadow-sm">
              <ShieldCheck size={14} /> Vendor-neutral · Built for food & beverage packaging
            </div>
            <h1 className="animate-fade-up mt-6 text-[2.6rem] font-semibold leading-[1.04] text-ink-900 sm:text-5xl lg:text-[4.1rem]" style={{ animationDelay: '80ms' }}>
              Know what to automate <em className="font-medium italic text-brand-600">before</em> you spend half a million on it.
            </h1>
            <p className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-ink-600" style={{ animationDelay: '160ms' }}>
              AutoScope is the automation expert most Mittelstand food producers don't have. Show us your packaging line and get an unbiased answer:
              <span className="font-semibold text-ink-800"> what</span> is worth automating, <span className="font-semibold text-ink-800">how</span>, and whether it <span className="font-semibold text-ink-800">pays off</span>.
            </p>

            <div className="animate-fade-up mt-9 space-y-3" style={{ animationDelay: '240ms' }}>
              <div className="flex flex-col gap-3 sm:flex-row">
                <button onClick={demo} className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-brand-600 px-6 py-3.5 text-base font-semibold text-white shadow-lg shadow-brand-700/25 transition hover:-translate-y-0.5 hover:bg-brand-700">
                  <Play size={17} className="fill-current" /> See the live demo <ArrowRight size={18} className="transition group-hover:translate-x-0.5" />
                </button>
                <button onClick={() => nav('/capture')} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 text-base font-semibold text-ink-800 ring-1 ring-ink-200 transition hover:-translate-y-0.5 hover:ring-brand-300">
                  <Video size={18} className="text-brand-600" /> Analyse my line from a video
                </button>
              </div>
              <button onClick={() => nav('/questionnaire')} className="group flex w-full items-center gap-4 rounded-2xl border border-sand-300 bg-sand-50 p-4 text-left transition hover:-translate-y-0.5 hover:border-sand-400 hover:shadow-md sm:max-w-[34rem]">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-sand-200 text-sand-700"><ClipboardList size={20} /></span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">No video? Answer guided questions <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">New</span></span>
                  <span className="mt-0.5 block text-sm text-ink-500">A 10-minute F&B questionnaire builds your line for you.</span>
                </span>
                <ChevronRight size={20} className="shrink-0 text-sand-600 transition group-hover:translate-x-1" />
              </button>
            </div>
            <div className="animate-fade-up mt-5 text-xs text-ink-400" style={{ animationDelay: '320ms' }}>Demo: Brunnenhof Getränke GmbH, a fictional 85-person mineral water bottler.</div>
          </div>
          <div className="animate-fade-up px-4 sm:px-8 lg:px-0" style={{ animationDelay: '200ms' }}>
            <HeroVisual />
          </div>
        </div>
      </section>

      {/* Problem strip */}
      <section className="border-y border-ink-200/70 bg-white">
        <div className="mx-auto grid max-w-7xl gap-px bg-ink-100 md:grid-cols-3">
          {[
            { icon: Euro, t: 'Wrong automation decisions cost €100k+', d: 'A robot cell that solves the wrong problem is an expensive monument on the shop floor.' },
            { icon: Users, t: 'Most SMEs have no automation engineer', d: 'The plant manager decides between offers they cannot fully compare.' },
            { icon: Store, t: 'Vendors only recommend what they sell', d: 'Ask a robot maker and the answer is a robot. Nobody tells you to fix the process first.' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 120} className="bg-white px-6 py-8 md:px-8 md:py-10">
              <c.icon size={22} className="text-sand-600" />
              <div className="mt-4 font-display text-xl font-semibold leading-snug text-ink-900">{c.t}</div>
              <p className="mt-2 text-sm text-ink-500">{c.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Three questions */}
      <section id="features" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 md:px-8 md:py-28">
        <SectionHead eyebrow="Three questions, one answer" title="Everything an automation consultant would tell you. In an afternoon." />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { icon: Target, n: '01', t: 'What to automate', d: 'Scores every station on labour, repetitiveness, ergonomics, quality, bottleneck and stability, with the reasons behind every score.' },
            { icon: Cpu, n: '02', t: 'How to automate it', d: 'Matches each task to a technology class (software, conveyor, special machine, cobot, robot, AGV, vision inspection) and explains why the alternatives lost.' },
            { icon: PiggyBank, n: '03', t: 'Does it pay off', d: 'Investment, savings, payback, NPV and risk, plus the probability of paying back across 1,000 simulated futures. A ranged answer you can trust.' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 140} className="group relative overflow-hidden rounded-3xl border border-ink-200/70 bg-white p-7 shadow-sm transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/5">
              <div className="absolute -right-4 -top-6 font-display text-[7rem] font-semibold leading-none text-ink-100 transition group-hover:text-brand-50">{c.n}</div>
              <div className="relative">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-brand-600 text-white shadow-md shadow-brand-700/20"><c.icon size={22} /></div>
                <h3 className="mt-6 font-display text-2xl font-semibold">{c.t}</h3>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-600">{c.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-24 bg-ink-100/60 py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <SectionHead eyebrow="How it works" title="From shop floor to business case in four steps" sub="A deterministic engine computes every number. Claude only captures your process and explains the results." />
          <div className="relative mt-16">
            <div className="absolute left-6 top-0 h-full w-px bg-gradient-to-b from-brand-300 via-brand-200 to-transparent md:left-0 md:top-6 md:h-px md:w-full md:bg-gradient-to-r" />
            <div className="grid gap-10 md:grid-cols-4 md:gap-6">
              {[
                { icon: Video, t: 'Capture', d: 'Upload a video or photos, answer guided questions, or sketch the line in the builder.' },
                { icon: Activity, t: 'Analyse the line', d: 'Find the bottleneck, estimate OEE and flag ergonomic strain station by station.' },
                { icon: Cpu, t: 'Recommend', d: 'Pick the right technology class and say plainly why the alternatives lost.' },
                { icon: PiggyBank, t: 'Pay-off', d: 'Ranged payback, risk and a phased roadmap you can take to integrators.' },
              ].map((s, i) => (
                <Reveal key={s.t} delay={i * 150} className="relative pl-16 md:pl-0">
                  <div className="absolute left-0 top-0 grid h-12 w-12 place-items-center rounded-full border-4 border-ink-50 bg-brand-700 text-white shadow-lg md:relative">
                    <s.icon size={20} />
                  </div>
                  <div className="md:mt-6">
                    <div className="text-xs font-bold uppercase tracking-wider text-brand-600">Step {i + 1}</div>
                    <h3 className="mt-1 font-display text-xl font-semibold">{s.t}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-ink-600">{s.d}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Three ways to start */}
      <section className="mx-auto max-w-7xl px-4 py-20 md:px-8 md:py-28">
        <SectionHead eyebrow="Three ways to start" title="Use whatever you have on hand" sub="No consultants, no site visit. Start with a phone video, a questionnaire or a whiteboard sketch." />
        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {[
            { icon: Video, t: 'Video capture', d: 'Film the line on your phone. AI identifies stations, manual tasks and cycle times for you to confirm.', to: '/capture', cta: 'Upload a video', tag: '' },
            { icon: ClipboardList, t: 'Guided questionnaire', d: 'No video? Answer plain-language questions about products, shifts and pain points. Built for F&B.', to: '/questionnaire', cta: 'Start questionnaire', tag: 'New' },
            { icon: Workflow, t: 'Line builder', d: 'Know your line by heart? Assemble stations, rates and staffing directly and get results instantly.', to: '/line', cta: 'Open line builder', tag: '' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 130}>
              <button onClick={() => nav(c.to)} className={`group flex h-full w-full flex-col rounded-3xl border p-7 text-left transition hover:-translate-y-1 hover:shadow-xl hover:shadow-brand-900/5 ${c.tag ? 'border-sand-300 bg-sand-50' : 'border-ink-200/70 bg-white'}`}>
                <div className="flex items-center justify-between">
                  <div className={`grid h-12 w-12 place-items-center rounded-2xl ${c.tag ? 'bg-sand-200 text-sand-700' : 'bg-brand-50 text-brand-700'}`}><c.icon size={22} /></div>
                  {c.tag && <span className="rounded-full bg-brand-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{c.tag}</span>}
                </div>
                <h3 className="mt-6 font-display text-2xl font-semibold">{c.t}</h3>
                <p className="mt-3 flex-1 text-[15px] leading-relaxed text-ink-600">{c.d}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-sm font-semibold text-brand-700">{c.cta} <ArrowRight size={16} className="transition group-hover:translate-x-1" /></span>
              </button>
            </Reveal>
          ))}
        </div>
      </section>

      {/* It can say no */}
      <section className="bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 md:px-8 lg:grid-cols-[1fr_1.3fr] lg:items-center">
          <SectionHead center={false} eyebrow="Honest verdicts" title="An advisor that can say no." sub="Every opportunity gets one of four verdicts. Sometimes the best automation investment is none at all, and AutoScope tells you so." />
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { icon: CheckCircle2, t: 'Automate now', d: 'Strong case, proven technology, payback inside your horizon.', cls: 'border-brand-200 bg-brand-50 text-brand-700' },
              { icon: Zap, t: 'Quick win', d: 'Low cost, low risk. Do it this quarter.', cls: 'border-sand-300 bg-sand-50 text-sand-700' },
              { icon: Wrench, t: 'Fix the process first', d: 'Automating chaos gives you faster chaos. Stabilise, then revisit.', cls: 'border-amber-200 bg-amber-50 text-amber-700' },
              { icon: XCircle, t: 'Do not automate', d: 'The numbers do not work. Keep the money, keep the people.', cls: 'border-rose-200 bg-rose-50 text-rose-700' },
            ].map((v, i) => (
              <Reveal key={v.t} delay={i * 110} className={`rounded-2xl border p-5 ${v.cls}`}>
                <v.icon size={22} />
                <div className="mt-3 font-display text-lg font-semibold text-ink-900">{v.t}</div>
                <p className="mt-1 text-sm text-ink-600">{v.d}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Demo results band */}
      <section className="relative overflow-hidden bg-brand-900 py-20 text-white md:py-24">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(50rem_25rem_at_100%_0%,rgba(154,167,90,0.25),transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-4 md:px-8">
          <Reveal className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-300">Demo result</div>
              <h2 className="mt-3 max-w-2xl text-3xl font-semibold leading-tight md:text-4xl">Brunnenhof Getränke GmbH</h2>
              <p className="mt-2 text-ink-300">A fictional 85-person mineral water bottler, two shifts, one PET line.</p>
            </div>
            <button onClick={demo} className="inline-flex items-center gap-2 self-start rounded-2xl bg-sand-200 px-5 py-3 text-sm font-semibold text-ink-900 transition hover:bg-sand-100 md:self-auto">
              Explore the demo <ArrowRight size={16} />
            </button>
          </Reveal>
          <div className="mt-12 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/10 lg:grid-cols-4">
            {[
              { label: 'Investment', node: <CountUp to={547} prefix="€" suffix="k" />, hint: 'Phased over the roadmap' },
              { label: 'Net benefit / year', node: <>~<CountUp to={488} prefix="€" suffix="k" /></>, hint: 'Labour, quality, throughput' },
              { label: 'Payback', node: <CountUp to={1.1} decimals={1} suffix=" yrs" />, hint: 'Simulated range 1.2–1.6 yrs' },
              { label: 'Jobs relieved', node: <CountUp to={4.7} decimals={1} />, hint: 'Redeployed, not laid off' },
            ].map((s, i) => (
              <Reveal key={s.label} delay={i * 120} className="bg-brand-900 p-6 md:p-8">
                <div className="text-xs font-semibold uppercase tracking-wider text-brand-300">{s.label}</div>
                <div className="mt-3 font-display text-4xl font-semibold md:text-5xl">{s.node}</div>
                <div className="mt-2 text-xs text-ink-300">{s.hint}</div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* Trust */}
      <section id="trust" className="mx-auto max-w-7xl scroll-mt-24 px-4 py-20 md:px-8 md:py-28">
        <SectionHead eyebrow="Built to be trusted" title="Neutral by design. Transparent by default." />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: Scale, t: 'No vendor bias', d: 'We recommend technology classes, never brands. No vendor pays for a result.' },
            { icon: Eye, t: 'No black box', d: 'Every score and euro comes from visible rules and assumptions you can edit.' },
            { icon: ShieldCheck, t: 'Your data stays yours', d: 'No account needed. Your line data stays in your browser.' },
            { icon: Briefcase, t: 'Office & admin too', d: 'Order entry, invoicing and planning get scored alongside the shop floor.' },
          ].map((c, i) => (
            <Reveal key={c.t} delay={i * 110} className="rounded-3xl border border-ink-200/70 bg-white p-6 shadow-sm">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-brand-50 text-brand-700"><c.icon size={20} /></div>
              <h3 className="mt-5 font-display text-lg font-semibold">{c.t}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{c.d}</p>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-4 pb-20 md:px-8">
        <Reveal className="relative mx-auto max-w-7xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 to-brand-800 px-6 py-14 text-center text-white shadow-2xl shadow-brand-900/20 md:px-12 md:py-20">
          <Sparkles className="mx-auto text-sand-200" size={28} />
          <h2 className="mx-auto mt-4 max-w-3xl text-3xl font-semibold leading-tight md:text-5xl">Get a second opinion before you sign the purchase order.</h2>
          <p className="mx-auto mt-4 max-w-xl text-brand-100">See the full analysis on the demo line, or start with your own in minutes.</p>
          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <button onClick={demo} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-3.5 font-semibold text-brand-800 transition hover:-translate-y-0.5">See the live demo <ArrowRight size={18} /></button>
            <button onClick={() => nav('/questionnaire')} className="inline-flex items-center justify-center gap-2 rounded-2xl px-6 py-3.5 font-semibold text-white ring-1 ring-white/40 transition hover:bg-white/10"><ClipboardList size={18} /> Answer guided questions</button>
          </div>
        </Reveal>
      </section>

      <footer className="border-t border-ink-200/70">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-4 py-8 md:flex-row md:items-center md:px-8">
          <Logo size={32} tagline={false} />
          <div className="text-xs text-ink-400">AutoScope · Hackathon prototype · Cost ranges are indicative; validate with integrator quotes.</div>
        </div>
      </footer>
    </div>
  );
}

import { useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import Logo from './Logo';

// Plays once per full page load (not when navigating back to "/" inside the app).
let played = false;
export const introWillPlay = () => !played && !(typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);

/**
 * Full-screen AutoScope intro. The big logo holds for a moment, then flies to the
 * header logo's position (FLIP) while the backdrop fades away.
 */
export default function IntroSplash({ targetRef, onDone }: { targetRef: RefObject<HTMLElement | null>; onDone?: () => void }) {
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [phase, setPhase] = useState<'hidden' | 'show' | 'fly' | 'done'>(played || reduced ? 'done' : 'show');
  const logoRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(onDone);
  doneRef.current = onDone;
  const [flyStyle, setFlyStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (phase !== 'show') return;
    played = true;
    document.body.style.overflow = 'hidden';
    const t = setTimeout(() => setPhase('fly'), 1500);
    return () => clearTimeout(t);
  }, [phase]);

  useLayoutEffect(() => {
    if (phase !== 'fly') return;
    const from = logoRef.current?.getBoundingClientRect();
    const to = targetRef.current?.getBoundingClientRect();
    if (from && to && from.width > 0) {
      const scale = to.width / from.width;
      const dx = to.left + to.width / 2 - (from.left + from.width / 2);
      const dy = to.top + to.height / 2 - (from.top + from.height / 2);
      setFlyStyle({ transform: `translate(${dx}px, ${dy}px) scale(${scale})` });
    } else {
      setFlyStyle({ opacity: 0 });
    }
    const t = setTimeout(() => {
      setPhase('done');
      document.body.style.overflow = '';
      doneRef.current?.();
    }, 950);
    return () => clearTimeout(t);
  }, [phase, targetRef]);

  useEffect(() => () => { document.body.style.overflow = ''; }, []);

  if (phase === 'done' || phase === 'hidden') return null;
  const flying = phase === 'fly';

  return (
    <div
      className="fixed inset-0 z-[100] cursor-pointer"
      onClick={() => setPhase('fly')}
      aria-hidden="true"
    >
      {/* backdrop */}
      <div
        className="absolute inset-0 bg-ink-50 transition-opacity duration-[900ms] ease-out"
        style={{ opacity: flying ? 0 : 1 }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,var(--color-brand-100),transparent_65%)]" />
      </div>

      <div className="absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center">
          <div
            ref={logoRef}
            className="transition-transform duration-[900ms] ease-[cubic-bezier(0.65,0,0.35,1)]"
            style={{ transformOrigin: 'center', ...flyStyle }}
          >
            <div className="intro-pop"><Logo size={120} tagline={false} /></div>
          </div>
          <div
            className="intro-sub mt-6 text-xs font-semibold uppercase tracking-[0.3em] text-brand-700 transition-opacity duration-300"
            style={{ opacity: flying ? 0 : undefined }}
          >
            Know what to automate
          </div>
          <div className="mt-6 h-1 w-48 overflow-hidden rounded-full bg-ink-200 transition-opacity duration-300" style={{ opacity: flying ? 0 : 1 }}>
            <div className="intro-bar h-full rounded-full bg-gradient-to-r from-brand-500 to-sand-400" />
          </div>
        </div>
      </div>

      <style>{`
        .intro-pop { animation: intro-pop 0.8s cubic-bezier(0.22,1,0.36,1) both; }
        .intro-sub { animation: intro-fade 0.6s 0.45s ease-out backwards; }
        .intro-bar { animation: intro-bar 1.4s 0.1s cubic-bezier(0.65,0,0.35,1) both; }
        @keyframes intro-pop { from { opacity: 0; transform: scale(0.85); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
        @keyframes intro-fade { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        @keyframes intro-bar { from { width: 0; } to { width: 100%; } }
      `}</style>
    </div>
  );
}

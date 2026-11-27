import { createElement, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';

/**
 * Scans the container (or whole document) for `.reveal` elements and adds `is-visible`
 * once each enters the viewport. Falls back to showing everything without IntersectionObserver.
 */
export function useReveal<T extends HTMLElement = HTMLDivElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const root: ParentNode = ref.current ?? document;
    const els = Array.from(root.querySelectorAll<HTMLElement>('.reveal:not(.is-visible)'));
    if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
      els.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('is-visible');
            io.unobserve(e.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
  return ref;
}

/** Returns [ref, visible] for a single element; visible flips true once (or immediately without IO). */
export function useInView<T extends HTMLElement = HTMLDivElement>(threshold = 0.3) {
  const ref = useRef<T>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!('IntersectionObserver' in window)) {
      setVisible(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);
  return [ref, visible] as const;
}

/** Wrapper component: <Reveal delay={120}>…</Reveal> */
export function Reveal({ children, delay = 0, as = 'div', className = '' }: { children: ReactNode; delay?: number; as?: string; className?: string }) {
  const [ref, visible] = useInView<HTMLElement>(0.12);
  return createElement(
    as,
    { ref, className: `reveal ${visible ? 'is-visible' : ''} ${className}`, style: { '--reveal-delay': `${delay}ms` } as CSSProperties },
    children,
  );
}

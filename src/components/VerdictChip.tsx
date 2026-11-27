import type { Verdict } from '../types';
import { cx } from './ui';

export const VERDICT_STYLE: Record<Verdict, { cls: string; dot: string; name: string }> = {
  now: { cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200', dot: '#10b981', name: 'Automate now' },
  quick: { cls: 'bg-brand-50 text-brand-700 ring-brand-200', dot: '#7d8b3f', name: 'Quick win / later' },
  fix: { cls: 'bg-amber-50 text-amber-800 ring-amber-200', dot: '#c3974b', name: 'Fix process first' },
  no: { cls: 'bg-rose-50 text-rose-700 ring-rose-200', dot: '#f43f5e', name: 'Do not automate' },
  done: { cls: 'bg-ink-100 text-ink-600 ring-ink-200', dot: '#a39a84', name: 'Already automated' },
};

export const VERDICT_ORDER: Verdict[] = ['now', 'quick', 'fix', 'no', 'done'];

export function VerdictChip({ verdict, label }: { verdict: Verdict; label?: string }) {
  const s = VERDICT_STYLE[verdict];
  return (
    <span className={cx('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ring-1', s.cls)}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
      {label ?? s.name}
    </span>
  );
}

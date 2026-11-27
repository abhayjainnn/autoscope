import type { ReactNode, ButtonHTMLAttributes, InputHTMLAttributes, SelectHTMLAttributes } from 'react';

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ');

export function PageHeader({ eyebrow, title, subtitle, actions }: { eyebrow?: string; title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4 border-b border-ink-200/60 pb-5 md:mb-8 md:pb-6">
      <div className="min-w-0">
        {eyebrow && <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-brand-600"><span className="h-px w-6 bg-brand-400" />{eyebrow}</div>}
        <h1 className="mt-2 break-words font-display text-2xl font-semibold sm:text-3xl leading-tight tracking-tight text-ink-900 md:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className, title, subtitle, actions }: { children: ReactNode; className?: string; title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className={cx('rounded-2xl border border-ink-200/70 bg-white p-5 shadow-[0_1px_2px_rgba(53,60,32,0.04),0_8px_24px_-12px_rgba(53,60,32,0.12)]', className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="font-display text-base font-semibold text-ink-900">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-500">{subtitle}</p>}
          </div>
          {actions}
        </div>
      )}
      {children}
    </div>
  );
}

export function Stat({ label, value, hint, tone = 'default' }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' | 'brand' }) {
  const toneCls = { default: 'text-ink-900', good: 'text-emerald-600', warn: 'text-amber-600', bad: 'text-rose-600', brand: 'text-brand-600' }[tone];
  return (
    <div className="relative overflow-hidden rounded-2xl border border-ink-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(53,60,32,0.04),0_8px_24px_-12px_rgba(53,60,32,0.12)]"><span className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-brand-400 via-sand-300 to-transparent" />
      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-400">{label}</div>
      <div className={cx('mt-1.5 font-display text-2xl font-semibold tracking-tight md:text-[1.75rem]', toneCls)}>{value}</div>
      {hint && <div className="mt-1 text-xs text-ink-400">{hint}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'default' }: { children: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad' | 'brand' }) {
  const toneCls = {
    default: 'bg-ink-100 text-ink-700 ring-ink-200',
    good: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    warn: 'bg-amber-50 text-amber-700 ring-amber-200',
    bad: 'bg-rose-50 text-rose-700 ring-rose-200',
    brand: 'bg-brand-50 text-brand-800 ring-brand-200',
  }[tone];
  return <span className={cx('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ring-transparent', toneCls)}>{children}</span>;
}

export function Button({ variant = 'primary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' }) {
  const v = {
    primary: 'bg-brand-600 text-white hover:bg-brand-700 shadow-sm shadow-brand-700/20 hover:shadow-md active:translate-y-px',
    secondary: 'bg-white text-ink-800 ring-1 ring-ink-200 hover:bg-sand-50 hover:ring-brand-300 active:translate-y-px',
    ghost: 'text-ink-600 hover:bg-ink-100 hover:text-ink-900',
  }[variant];
  return <button {...props} className={cx('inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2 focus-visible:ring-offset-ink-50 disabled:cursor-not-allowed disabled:opacity-50', v, className)} />;
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold text-ink-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}
    </label>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cx('w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-[inset_0_1px_1px_rgba(53,60,32,0.04)] outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100', props.className)} />;
}

export function NumberInput({ value, onChange, step, min, max, suffix }: { value: number; onChange: (n: number) => void; step?: number; min?: number; max?: number; suffix?: string }) {
  return (
    <div className="relative">
      <Input type="number" value={Number.isFinite(value) ? value : 0} step={step} min={min} max={max} onChange={(e) => onChange(parseFloat(e.target.value) || 0)} className={suffix ? 'pr-12' : ''} />
      {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-ink-400">{suffix}</span>}
    </div>
  );
}

export function Select(props: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select {...props} className={cx('w-full rounded-xl border border-ink-200 bg-white px-3 py-2 text-sm text-ink-900 shadow-[inset_0_1px_1px_rgba(53,60,32,0.04)] outline-none transition placeholder:text-ink-400 hover:border-ink-300 focus:border-brand-500 focus:ring-4 focus:ring-brand-100', props.className)} />;
}

export function Slider({ value, onChange, min, max, step = 1, format }: { value: number; onChange: (n: number) => void; min: number; max: number; step?: number; format?: (n: number) => string }) {
  return (
    <div className="flex items-center gap-3">
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full accent-brand-600" />
      <span className="w-20 shrink-0 text-right text-sm font-semibold tabular-nums text-ink-800">{format ? format(value) : value}</span>
    </div>
  );
}

export function ScoreBar({ value, max = 100, tone = 'brand' }: { value: number; max?: number; tone?: 'brand' | 'good' | 'warn' | 'bad' }) {
  const color = { brand: 'bg-gradient-to-r from-brand-600 to-brand-400', good: 'bg-emerald-500', warn: 'bg-amber-500', bad: 'bg-rose-500' }[tone];
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-ink-100">
      <div className={cx('h-full rounded-full transition-all', color)} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} />
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-ink-300 bg-sand-50/60 p-10 text-center">
      <div className="font-display text-base font-semibold text-ink-800">{title}</div>
      {children && <div className="mt-2 text-sm text-ink-500">{children}</div>}
    </div>
  );
}

export { cx };

import { useState } from 'react';
import { Sparkles, RefreshCw, AlertTriangle } from 'lucide-react';
import { explain } from '../lib/ai';
import { Badge } from './ui';

export function AiText({ text }: { text: string }) {
  const blocks = text.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  return (
    <div className="space-y-2 text-sm leading-relaxed text-ink-700">
      {blocks.map((b, i) => {
        const lines = b.split('\n').map((l) => l.trim()).filter(Boolean);
        if (lines.length && lines.every((l) => /^([-*•]|\d+[.)])\s+/.test(l))) {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5 marker:text-brand-400">
              {lines.map((l, j) => (
                <li key={j}>{renderInline(l.replace(/^([-*•]|\d+[.)])\s+/, ''))}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{lines.map((l, j) => <span key={j}>{j > 0 && <br />}{renderInline(l.replace(/^#+\s*/, ''))}</span>)}</p>;
      })}
    </div>
  );
}

function renderInline(s: string) {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => (p.startsWith('**') && p.endsWith('**') ? <strong key={i} className="font-semibold text-ink-900">{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>));
}

export default function AiExplain({ title, prompt, context }: { title?: string; prompt: string; context: unknown }) {
  const [state, setState] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [text, setText] = useState('');
  const [mock, setMock] = useState(false);
  const [err, setErr] = useState('');

  const run = async () => {
    setState('loading');
    setErr('');
    try {
      const r = await explain(prompt, context);
      setText(r.text);
      setMock(r.mock);
      setState('done');
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setState('error');
    }
  };

  return (
    <div className="no-print rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50/70 via-white to-white p-4 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="grid h-7 w-7 place-items-center rounded-lg bg-brand-600/10 text-brand-600">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="text-sm font-semibold text-ink-900">{title ?? 'AI explanation'}</div>
          {state === 'done' && mock && <Badge tone="warn">demo mode</Badge>}
        </div>
        {state === 'idle' && (
          <button onClick={run} className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-700">
            <Sparkles className="h-3.5 w-3.5" /> Explain with AI
          </button>
        )}
        {(state === 'done' || state === 'error') && (
          <button onClick={run} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs font-medium text-ink-500 transition hover:bg-ink-100 hover:text-ink-700">
            <RefreshCw className="h-3.5 w-3.5" /> Regenerate
          </button>
        )}
      </div>
      {state === 'idle' && <p className="mt-2 text-xs text-ink-500">A plain-language summary for decision makers. Every number comes from the AutoScope engine.</p>}
      {state === 'loading' && (
        <div className="mt-3 space-y-2" aria-busy="true">
          {[92, 100, 78, 85, 60].map((w, i) => (
            <div key={i} className="h-3 animate-pulse rounded bg-gradient-to-r from-brand-100 via-ink-100 to-brand-100" style={{ width: `${w}%`, animationDelay: `${i * 120}ms` }} />
          ))}
        </div>
      )}
      {state === 'done' && (
        <div className="mt-3">
          <AiText text={text} />
          <p className="mt-3 text-[11px] text-ink-400">AI-written explanation. Figures come from the deterministic engine.</p>
        </div>
      )}
      {state === 'error' && (
        <div className="mt-3 flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>Couldn't get an explanation right now. {err}</span>
        </div>
      )}
    </div>
  );
}

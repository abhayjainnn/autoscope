import { useEffect, useMemo, useRef, useState } from 'react';
import { Send, Sparkles, Trash2, Bot, User, AlertTriangle } from 'lucide-react';
import { useAnalysis, useApp } from '../store';
import { buildAiContext, chat, aiHealth } from '../lib/ai';
import { AiText } from '../components/AiExplain';
import { Badge, Button, PageHeader, cx } from '../components/ui';
import type { ChatMessage } from '../types';

const SUGGESTIONS = [
  'Why a cobot instead of an industrial robot for palletizing?',
  'What if labour cost rises 10%?',
  'What should we do first with €150k?',
  'What are the biggest risks?',
  'Explain our payback in plain words for the owner.',
];

export default function Advisor() {
  const bundle = useAnalysis();
  const profile = useApp((s) => s.profile);
  const line = useApp((s) => s.line);
  const catalog = useApp((s) => s.catalog);
  const messages = useApp((s) => s.chat);
  const setChat = useApp((s) => s.setChat);

  const context = useMemo(() => buildAiContext(bundle, profile, line, catalog), [bundle, profile, line, catalog]);

  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [mock, setMock] = useState(false);
  const [aiOn, setAiOn] = useState<boolean | null>(null);
  const [error, setError] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    aiHealth().then((h) => setAiOn(h.ai));
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages.length, busy]);

  const send = async (raw: string) => {
    const q = raw.trim();
    if (!q || busy) return;
    const next: ChatMessage[] = [...messages, { role: 'user', content: q }];
    setChat(next);
    setInput('');
    setBusy(true);
    setError('');
    try {
      const r = await chat(next, context);
      setMock(r.mock);
      setChat([...next, { role: 'assistant', content: r.text }]);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      inputRef.current?.focus();
    }
  };

  const demo = mock || aiOn === false;

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[560px] flex-col">
      <PageHeader
        eyebrow="Act"
        title="AI Advisor"
        subtitle="Ask questions about your analysis. The advisor is vendor-neutral and grounded in the numbers computed by the AutoScope engine; it marks rough what-if estimates as such."
        actions={
          <>
            {demo && <Badge tone="warn">demo mode</Badge>}
            {aiOn && !mock && <Badge tone="good">AI connected</Badge>}
            <Button variant="secondary" onClick={() => setChat([])} disabled={messages.length === 0 || busy}>
              <Trash2 className="h-4 w-4" /> Clear chat
            </Button>
          </>
        }
      />

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-ink-100 bg-white shadow-sm">
        <div ref={scrollRef} className="min-h-0 flex-1 space-y-5 overflow-y-auto p-5 md:p-6">
          {messages.length === 0 && (
            <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-lg">
                <Sparkles className="h-7 w-7" />
              </div>
              <h2 className="mt-4 text-lg font-bold text-ink-900">How can I help with {profile.name || 'your line'}?</h2>
              <p className="mt-1 text-sm text-ink-500">
                I know your line, scores, recommended technologies, ROI, roadmap and risk simulation. I never recommend brands.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="rounded-full border border-ink-200 bg-white px-3.5 py-1.5 text-sm text-ink-700 shadow-sm transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <Bubble key={i} m={m} />
          ))}

          {busy && (
            <div className="flex items-start gap-3">
              <Avatar role="assistant" />
              <div className="rounded-2xl rounded-tl-sm bg-ink-50 px-4 py-3">
                <div className="flex items-center gap-1">
                  {[0, 1, 2].map((d) => (
                    <span key={d} className="h-2 w-2 animate-bounce rounded-full bg-brand-400" style={{ animationDelay: `${d * 150}ms` }} />
                  ))}
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Couldn't reach the advisor: {error}
            </div>
          )}
        </div>

        {messages.length > 0 && (
          <div className="flex gap-2 overflow-x-auto border-t border-ink-100 px-4 pt-3">
            {SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                disabled={busy}
                className="shrink-0 rounded-full border border-ink-200 px-3 py-1 text-xs text-ink-600 transition hover:border-brand-300 hover:bg-brand-50 hover:text-brand-700 disabled:opacity-50"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        <form
          className="flex items-end gap-2 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                send(input);
              }
            }}
            rows={1}
            placeholder="Ask about your automation plan…  (Enter to send, Shift+Enter for a new line)"
            className="max-h-40 min-h-[44px] flex-1 resize-none rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm text-ink-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100"
          />
          <Button type="submit" disabled={!input.trim() || busy} className="h-11 w-11 shrink-0 p-0" aria-label="Send">
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
      <p className="mt-2 text-center text-[11px] text-ink-400">AI answers can be wrong. Computed figures come from the deterministic engine; change assumptions on the respective pages.</p>
    </div>
  );
}

function Avatar({ role }: { role: ChatMessage['role'] }) {
  return (
    <div
      className={cx(
        'grid h-8 w-8 shrink-0 place-items-center rounded-full',
        role === 'assistant' ? 'bg-gradient-to-br from-brand-500 to-brand-700 text-white' : 'bg-ink-100 text-ink-600',
      )}
    >
      {role === 'assistant' ? <Bot className="h-4 w-4" /> : <User className="h-4 w-4" />}
    </div>
  );
}

function Bubble({ m }: { m: ChatMessage }) {
  const isUser = m.role === 'user';
  return (
    <div className={cx('flex items-start gap-3', isUser && 'flex-row-reverse')}>
      <Avatar role={m.role} />
      <div
        className={cx(
          'max-w-[80%] rounded-2xl px-4 py-3',
          isUser ? 'rounded-tr-sm bg-brand-600 text-sm leading-relaxed text-white' : 'rounded-tl-sm bg-ink-50',
        )}
      >
        {isUser ? <div className="whitespace-pre-wrap">{m.content}</div> : <AiText text={m.content} />}
      </div>
    </div>
  );
}

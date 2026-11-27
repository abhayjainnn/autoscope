# AutoScope

Vendor-neutral automation advisor for food & beverage packaging SMEs. It answers three questions: **what** is worth automating, **how** (which technology class), and **does it pay off** (investment, payback, NPV, risk).

## Structure

| Part | Where | What |
| --- | --- | --- |
| Frontend | `src/` | React 18 + Vite + TypeScript + Tailwind, zustand store, recharts, React Flow |
| Engine | `src/engine/` | Deterministic, explainable scoring, tech matching, ROI, Monte Carlo, verdicts, office processes |
| Backend | `server/handlers.ts` | Claude API calls: process extraction (text / photos / video frames), explanations, advisor chat. Falls back to demo mode without a key |
| Serverless entry | `api/[name].ts` | Vercel function exposing `/api/extract`, `/api/explain`, `/api/chat`, `/api/health` |

## Run locally

```bash
npm install
echo ANTHROPIC_API_KEY=sk-ant-... > .env.local   # optional; without it AI runs in demo mode
npm run dev
```

## Deploy

Vercel: import the repo, set `ANTHROPIC_API_KEY` as an environment variable, deploy. `vercel.json` handles SPA routing and function timeouts.

Cost figures are planning assumptions, editable in the app; validate with integrator quotes.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { dispatch } from '../server/handlers.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const raw = req.query.name;
  const name = Array.isArray(raw) ? raw[0] : raw ?? '';
  let body: any = req.body ?? {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      body = {};
    }
  }
  try {
    const result = await dispatch(String(name), body);
    res.status(result.status).json(result.body);
  } catch (e) {
    res.status(500).json({ error: e instanceof Error ? e.message : String(e) });
  }
}

import type { MlbTransaction } from '../core/official';

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * MLB data is requested by the visitor's browser and held in memory only. It is never
 * stored, cached or republished. See the About page for the usage terms.
 */
const inFlight = new Map<number, Promise<MlbTransaction[]>>();

/** Panels on one page share a single request, which is kept only in memory. */
export function fetchTransactions(days = 7, now = new Date()): Promise<MlbTransaction[]> {
  const existing = inFlight.get(days);
  if (existing) return existing;
  const request = load(days, now);
  inFlight.set(days, request);
  request.catch(() => inFlight.delete(days));
  return request;
}

async function load(days: number, now: Date): Promise<MlbTransaction[]> {
  const start = new Date(now.getTime() - days * 86_400_000);
  // Major league clubs and only the fields used here, to keep each request small.
  const fields = 'transactions,id,date,typeDesc,description,person,id,toTeam,fromTeam';
  const url = `https://statsapi.mlb.com/api/v1/transactions?startDate=${isoDay(start)}&endDate=${isoDay(now)}&sportId=1&fields=${fields}`;
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`MLB API ${response.status}`);
  const body = (await response.json()) as { transactions?: MlbTransaction[] };
  return Array.isArray(body.transactions) ? body.transactions : [];
}

/** Requests one player's moves, so a thread page never downloads the league's. */
export async function fetchPlayerTransactions(playerId: number): Promise<MlbTransaction[]> {
  const response = await fetch(`https://statsapi.mlb.com/api/v1/transactions?playerId=${playerId}&fields=transactions,id,date,typeDesc,description,person,id,toTeam,fromTeam`, { credentials: 'omit' });
  if (!response.ok) throw new Error(`MLB API ${response.status}`);
  const body = (await response.json()) as { transactions?: MlbTransaction[] };
  return Array.isArray(body.transactions) ? body.transactions : [];
}

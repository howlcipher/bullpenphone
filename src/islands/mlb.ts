import type { MlbTransaction } from '../core/official';

const isoDay = (date: Date): string => date.toISOString().slice(0, 10);

/**
 * MLB data is requested by the visitor's browser and held in memory only. It is never
 * stored, cached or republished. See the About page for the usage terms.
 */
export async function fetchTransactions(days = 21, now = new Date()): Promise<MlbTransaction[]> {
  const start = new Date(now.getTime() - days * 86_400_000);
  const url = `https://statsapi.mlb.com/api/v1/transactions?startDate=${isoDay(start)}&endDate=${isoDay(now)}`;
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(`MLB API ${response.status}`);
  const body = (await response.json()) as { transactions?: MlbTransaction[] };
  return Array.isArray(body.transactions) ? body.transactions : [];
}

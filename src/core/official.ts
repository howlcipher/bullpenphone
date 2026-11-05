import { TEAM_BY_MLB_ID } from './teams';

export interface MlbTransaction {
  id?: number;
  date?: string;
  effectiveDate?: string;
  typeDesc?: string;
  description?: string;
  person?: { id?: number; fullName?: string };
  toTeam?: { id?: number };
  fromTeam?: { id?: number };
}

const ACQUISITIONS = new Set(['Trade', 'Signed as Free Agent', 'Signed', 'Claimed Off Waivers', 'Contract Extension', 'Selected']);
const VISIBLE = new Set([...ACQUISITIONS, 'Released', 'Designated for Assignment', 'Outrighted']);

export const teamAbbr = (id: number | undefined): string | null => (id === undefined ? null : TEAM_BY_MLB_ID.get(id)?.abbr ?? null);

const involvesClub = (txn: MlbTransaction): boolean => teamAbbr(txn.toTeam?.id) !== null || teamAbbr(txn.fromTeam?.id) !== null;

/** Drops winter-league moves, assignments and status changes. */
export function filterVisibleTransactions(transactions: MlbTransaction[]): MlbTransaction[] {
  return transactions.filter((txn) => VISIBLE.has(txn.typeDesc ?? '') && involvesClub(txn));
}

export function isHeadlineMove(txn: MlbTransaction): boolean {
  return !/minor league/i.test(txn.description ?? '');
}

interface OfficialTarget {
  mlbamId: number | null;
  teams: string[];
  firstSeenAt: string;
}

const SLACK_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Official means an acquisition by an MLB club for this exact player id, dated around
 * or after the thread began, and consistent with any club the reports named.
 */
export function officialMatch(thread: OfficialTarget, transactions: MlbTransaction[]): MlbTransaction | null {
  if (thread.mlbamId === null) return null;
  const floor = Date.parse(thread.firstSeenAt) - SLACK_MS;
  const candidates = transactions.filter((txn) => {
    if (txn.person?.id !== thread.mlbamId || !ACQUISITIONS.has(txn.typeDesc ?? '')) return false;
    const to = teamAbbr(txn.toTeam?.id);
    if (to === null) return false;
    if (Date.parse(txn.date ?? '') < floor) return false;
    return thread.teams.length === 0 || thread.teams.includes(to);
  });
  return candidates.sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''))[0] ?? null;
}

export function officialIndex<T extends OfficialTarget & { id: string }>(threads: T[], transactions: MlbTransaction[]): Map<string, MlbTransaction> {
  const out = new Map<string, MlbTransaction>();
  for (const thread of threads) {
    const match = officialMatch(thread, transactions);
    if (match) out.set(thread.id, match);
  }
  return out;
}

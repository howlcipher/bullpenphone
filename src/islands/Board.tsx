import { useEffect, useMemo, useState } from 'preact/hooks';
import { filterVisibleTransactions, isHeadlineMove, officialIndex, teamAbbr, type MlbTransaction } from '../core/official';
import { latestSchema, STATUSES, type ThreadSummary } from '../core/schemas';
import { TEAMS } from '../core/teams';
import { fetchTransactions } from './mlb';
import { ThreadCard } from './ThreadCard';

interface Props {
  initial: ThreadSummary[];
  generatedAt: string;
  base: string;
  rawUrl: string;
  pagesUrl: string;
  /** Locks the board to one club on team pages. */
  team?: string;
  showMoves?: boolean;
}

const KEY = 'bullpenphone.followed';
const PAGE_SIZE = 40;
const readFollowed = (): string[] => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === 'string') : [];
  } catch {
    return [];
  }
};
const writeFollowed = (teams: string[]): void => {
  try {
    localStorage.setItem(KEY, JSON.stringify(teams));
  } catch {
    /* Following just won't persist in this browser. */
  }
};

async function fetchLatest(urls: string[]): Promise<{ generatedAt: string; threads: ThreadSummary[] } | null> {
  for (const url of urls) {
    try {
      const response = await fetch(url, { credentials: 'omit', cache: 'no-cache' });
      if (!response.ok) continue;
      const parsed = latestSchema.safeParse(await response.json());
      if (parsed.success) return parsed.data;
    } catch {
      /* Try the next location. */
    }
  }
  return null;
}

export default function Board({ initial, generatedAt, base, rawUrl, pagesUrl, team, showMoves = false }: Props) {
  const [threads, setThreads] = useState(initial);
  const [updated, setUpdated] = useState(generatedAt);
  const [now, setNow] = useState(Date.parse(generatedAt));
  const [followed, setFollowed] = useState<string[]>([]);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [transactions, setTransactions] = useState<MlbTransaction[]>([]);
  const [officialState, setOfficialState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [limit, setLimit] = useState(PAGE_SIZE);

  useEffect(() => {
    setFollowed(readFollowed());
    setNow(Date.now());
    let active = true;
    const refresh = async () => {
      const latest = await fetchLatest([rawUrl, pagesUrl]);
      if (active && latest && latest.generatedAt > generatedAt) {
        setThreads(latest.threads);
        setUpdated(latest.generatedAt);
      }
      if (active) setNow(Date.now());
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, 300_000);
    fetchTransactions()
      .then((list) => {
        if (!active) return;
        setTransactions(list);
        setOfficialState('ok');
      })
      .catch(() => {
        if (active) setOfficialState('failed');
      });
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  const official = useMemo(() => officialIndex(threads, transactions), [threads, transactions]);
  const moves = useMemo(() => filterVisibleTransactions(transactions).filter(isHeadlineMove).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')).slice(0, 8), [transactions]);

  const visible = threads.filter((thread) => {
    if (team && !thread.teams.includes(team)) return false;
    if (!team && followed.length > 0 && !thread.teams.some((abbr) => followed.includes(abbr))) return false;
    if (type !== 'all' && thread.type !== type) return false;
    if (status === 'Official') return official.has(thread.id);
    if (status !== 'all' && thread.status !== status) return false;
    return true;
  });

  const shown = visible.slice(0, limit);
  useEffect(() => setLimit(PAGE_SIZE), [followed, type, status]);

  const toggle = (abbr: string) => {
    const next = followed.includes(abbr) ? followed.filter((value) => value !== abbr) : [...followed, abbr];
    setFollowed(next);
    writeFollowed(next);
  };

  return (
    <div>
      <div class="controls">
        {team ? null : (
          <details class="follow">
            <summary>{followed.length ? `Following ${followed.length} ${followed.length === 1 ? 'team' : 'teams'}` : 'Follow teams'}</summary>
            <fieldset class="follow-grid">
              <legend class="visually-hidden">Teams to follow</legend>
              {[...TEAMS].sort((a, b) => a.abbr.localeCompare(b.abbr)).map((entry) => (
                <label key={entry.abbr} title={entry.name}>
                  <input type="checkbox" checked={followed.includes(entry.abbr)} onChange={() => toggle(entry.abbr)} aria-label={entry.name} />
                  {entry.abbr}
                </label>
              ))}
            </fieldset>
            {followed.length ? <button type="button" class="linklike" onClick={() => { setFollowed([]); writeFollowed([]); }}>Clear all</button> : null}
          </details>
        )}
        <label class="field">Type
          <select value={type} onChange={(event) => setType(event.currentTarget.value)}>
            <option value="all">All</option>
            <option value="player">Players</option>
            <option value="team">Team needs</option>
            <option value="staff">Staff</option>
            <option value="league">League</option>
          </select>
        </label>
        <label class="field">Status
          <select value={status} onChange={(event) => setStatus(event.currentTarget.value)}>
            <option value="all">Any</option>
            <option value="Official">Official</option>
            {STATUSES.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <p class="meta" aria-live="polite">
        <span>{shown.length < visible.length ? `Showing ${shown.length} of ${visible.length} threads` : `${visible.length} ${visible.length === 1 ? 'thread' : 'threads'}`}</span>
        <span>Updated <time dateTime={updated}>{new Date(updated).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'UTC' })} UTC</time></span>
        {officialState === 'failed' ? <span>Official badges unavailable right now</span> : null}
      </p>
      {visible.length ? (
        <>
          <ul class="card-list">
            {shown.map((thread) => <ThreadCard thread={thread} now={now} base={base} official={official.get(thread.id)} key={thread.id} />)}
          </ul>
          {shown.length < visible.length ? (
            <button type="button" class="show-more" onClick={() => setLimit(limit + PAGE_SIZE)}>
              Show {Math.min(PAGE_SIZE, visible.length - shown.length)} more
            </button>
          ) : null}
        </>
      ) : (
        <p class="empty">Nothing matches these filters yet. During quiet stretches, or if a work stoppage freezes moves, this board can stay empty for a while.</p>
      )}
      {showMoves && moves.length ? (
        <section class="panel" aria-labelledby="moves-heading">
          <h2 id="moves-heading">Official moves</h2>
          <p class="note">Live from MLB, read by your browser. Minor league deals hidden.</p>
          <ul>
            {moves.map((move, position) => (
              <li key={move.id ?? position}>
                <span>{move.description}</span>
                <div class="meta"><span>{move.date}</span>{teamAbbr(move.toTeam?.id) ? <span>{teamAbbr(move.toTeam?.id)}</span> : null}</div>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

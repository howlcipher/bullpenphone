import { useEffect, useMemo, useState } from 'preact/hooks';
import { teamAbbr } from '../core/official';
import { nameKey } from '../core/text';

interface Row { id: number; name: string; position: string; from: string; signedWith: string; declared: string }
type SortKey = 'name' | 'position' | 'from';

export const offseasonYear = (now: Date): number => (now.getUTCMonth() < 2 ? now.getUTCFullYear() - 1 : now.getUTCFullYear());

interface Raw {
  player?: { id?: number; fullName?: string };
  position?: { abbreviation?: string };
  originalTeam?: { id?: number };
  newTeam?: { id?: number };
  dateDeclared?: string;
}

export default function FreeAgents({ base, threadIds }: { base: string; threadIds: Record<string, string> }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [query, setQuery] = useState('');
  const [position, setPosition] = useState('all');
  const [sort, setSort] = useState<SortKey>('name');
  const [limit, setLimit] = useState(50);

  useEffect(() => {
    const season = offseasonYear(new Date());
    fetch(`https://statsapi.mlb.com/api/v1/people/freeAgents?season=${season}`, { credentials: 'omit' })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        const body = (await response.json()) as { freeAgents?: Raw[] };
        setRows(
          (body.freeAgents ?? []).flatMap((raw) => {
            if (!raw.player?.id || !raw.player.fullName) return [];
            return [{
              id: raw.player.id,
              name: raw.player.fullName,
              position: raw.position?.abbreviation ?? '',
              from: teamAbbr(raw.originalTeam?.id) ?? '',
              signedWith: teamAbbr(raw.newTeam?.id) ?? '',
              declared: raw.dateDeclared ?? '',
            }];
          }),
        );
        setState('ok');
      })
      .catch(() => setState('failed'));
  }, []);

  const positions = useMemo(() => [...new Set(rows.map((row) => row.position).filter(Boolean))].sort(), [rows]);
  const needle = nameKey(query);
  const shown = rows
    .filter((row) => (position === 'all' || row.position === position) && (!needle || nameKey(row.name).includes(needle)))
    .sort((a, b) => a[sort].localeCompare(b[sort]) || a.name.localeCompare(b.name));

  if (state === 'loading') return <p class="empty">Loading the list from MLB…</p>;
  if (state === 'failed') return <p class="empty">MLB's list isn't available right now. Please try again later.</p>;

  return (
    <div>
      <div class="controls">
        <label class="field">Find a player
          <input type="search" value={query} onInput={(event) => { setQuery(event.currentTarget.value); setLimit(50); }} />
        </label>
        <label class="field">Sort by
          <select value={sort} onChange={(event) => setSort(event.currentTarget.value as SortKey)}>
            <option value="name">Name</option>
            <option value="position">Position</option>
            <option value="from">Last club</option>
          </select>
        </label>
        <label class="field">Position
          <select value={position} onChange={(event) => setPosition(event.currentTarget.value)}>
            <option value="all">All</option>
            {positions.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <p class="meta" aria-live="polite">{shown.length} {shown.length === 1 ? 'player' : 'players'}</p>
      <div class="table-wrap">
        <table class="stack-table" role="table" aria-label="Free agents">
          <thead role="rowgroup">
            <tr role="row">
              <th scope="col" role="columnheader">Player</th>
              <th scope="col" role="columnheader">Pos</th>
              <th scope="col" role="columnheader">Last club</th>
              <th scope="col" role="columnheader">Signed with</th>
              <th scope="col" role="columnheader">Rumors</th>
            </tr>
          </thead>
          <tbody role="rowgroup">
            {shown.slice(0, limit).map((row) => {
              const thread = threadIds[String(row.id)];
              return (
                <tr role="row" key={row.id}>
                  <td role="cell" class="stack-title">{row.name}</td>
                  <td role="cell" data-label="Pos">{row.position}</td>
                  <td role="cell" data-label="Last club">{row.from}</td>
                  <td role="cell" data-label="Signed with" class={row.signedWith ? '' : 'stack-empty'}>{row.signedWith}</td>
                  <td role="cell" data-label="Rumors" class={thread ? '' : 'stack-empty'}>{thread ? <a class="tap-link" href={`${base}t/${thread}/`}>View thread</a> : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {limit < shown.length ? <button type="button" class="show-more" onClick={() => setLimit(limit + 50)}>Show {Math.min(50, shown.length - limit)} more</button> : null}
    </div>
  );
}

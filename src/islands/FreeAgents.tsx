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
          <input type="search" value={query} onInput={(event) => setQuery(event.currentTarget.value)} />
        </label>
        <label class="field">Position
          <select value={position} onChange={(event) => setPosition(event.currentTarget.value)}>
            <option value="all">All</option>
            {positions.map((value) => <option value={value} key={value}>{value}</option>)}
          </select>
        </label>
      </div>
      <p class="meta" aria-live="polite">{shown.length} players</p>
      <div class="table-wrap" tabIndex={0} role="region" aria-label="Free agents">
        <table>
          <thead>
            <tr>
              <th scope="col" aria-sort={sort === 'name' ? 'ascending' : 'none'}><button type="button" onClick={() => setSort('name')}>Player</button></th>
              <th scope="col" aria-sort={sort === 'position' ? 'ascending' : 'none'}><button type="button" onClick={() => setSort('position')}>Pos</button></th>
              <th scope="col" aria-sort={sort === 'from' ? 'ascending' : 'none'}><button type="button" onClick={() => setSort('from')}>Last club</button></th>
              <th scope="col">Signed with</th>
              <th scope="col">Rumors</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => {
              const thread = threadIds[String(row.id)];
              return (
                <tr key={row.id}>
                  <td>{row.name}</td>
                  <td>{row.position}</td>
                  <td>{row.from}</td>
                  <td>{row.signedWith}</td>
                  <td>{thread ? <a href={`${base}t/${thread}/`}>View thread</a> : ''}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

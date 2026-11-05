import { useEffect, useMemo, useState } from 'preact/hooks';
import { filterVisibleTransactions, isHeadlineMove, teamAbbr, type MlbTransaction } from '../core/official';
import { fetchTransactions } from './mlb';

const SHOWN = 10;

export default function OfficialMoves() {
  const [all, setAll] = useState<MlbTransaction[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [minors, setMinors] = useState(false);

  useEffect(() => {
    setOpen(window.matchMedia('(min-width: 900px)').matches);
    let active = true;
    fetchTransactions()
      .then((list) => {
        if (active) setAll(filterVisibleTransactions(list).sort((a, b) => (b.date ?? '').localeCompare(a.date ?? '')));
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const moves = useMemo(() => (all ?? []).filter((move) => minors || isHeadlineMove(move)).slice(0, SHOWN), [all, minors]);
  if (failed || all === null) return null;

  return (
    <section class="panel live" aria-labelledby="moves-toggle">
      <button type="button" id="moves-toggle" class="live-toggle" aria-expanded={open} aria-controls="moves-body" onClick={() => setOpen(!open)}>
        <span class="live-arrow" aria-hidden="true">{open ? '\u25BE' : '\u25B8'}</span>
        <span class="live-title">Official moves</span>
        {moves.length ? <span class="count"> latest {moves.length}</span> : null}
      </button>
      <div id="moves-body" class="live-body" hidden={!open}>
        <p class="note">The last week, live from MLB. Read by your browser and never stored here.</p>
        <label class="check-row"><input type="checkbox" checked={minors} onChange={(event) => setMinors(event.currentTarget.checked)} /> Include minor league deals</label>
        {moves.length === 0 ? <p class="note">No moves to show in the last week.</p> : null}
        <ul>
          {moves.map((move, position) => (
            <li key={move.id ?? position}>
              <span>{move.description}</span>
              <div class="meta"><span>{move.date}</span>{teamAbbr(move.toTeam?.id) ? <span>{teamAbbr(move.toTeam?.id)}</span> : null}</div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

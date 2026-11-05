import { useEffect, useState } from 'preact/hooks';
import { officialMatch, type MlbTransaction } from '../core/official';
import { fetchPlayerTransactions } from './mlb';

interface Props { mlbamId: number; teams: string[]; firstSeenAt: string }

export default function OfficialBadge({ mlbamId, teams, firstSeenAt }: Props) {
  const [match, setMatch] = useState<MlbTransaction | null>(null);
  useEffect(() => {
    let active = true;
    fetchPlayerTransactions(mlbamId)
      .then((list) => {
        if (active) setMatch(officialMatch({ mlbamId, teams, firstSeenAt }, list));
      })
      .catch(() => {
        /* The badge only appears on a confirmed match. */
      });
    return () => {
      active = false;
    };
  }, []);
  if (!match) return null;
  return (
    <p class="panel" role="status">
      <span class="pill status-official">Official</span> {match.description} <span class="meta">{match.date}, per MLB</span>
    </p>
  );
}

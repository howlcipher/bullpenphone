import { isStale, statusClass, timeAgo } from '../core/display';
import { isHttpsUrl, type ThreadSummary } from '../core/schemas';
import type { MlbTransaction } from '../core/official';

interface Props { thread: ThreadSummary; now: number; base: string; official?: MlbTransaction }

const TYPE_LABEL: Record<ThreadSummary['type'], string> = { player: 'Player', team: 'Team', staff: 'Staff', league: 'League' };

export function ThreadCard({ thread, now, base, official }: Props) {
  const stale = isStale(thread.lastActivityAt, now);
  const href = isHttpsUrl(thread.top.url) ? thread.top.url : undefined;
  return (
    <li class={`card${stale ? ' stale' : ''}`} data-thread={thread.id}>
      <div class="card-top">
        <a class="subject" href={`${base}t/${thread.id}/`}>{thread.subject}</a>
        {official ? <span class="pill status-official">Official</span> : null}
        {thread.status && !official ? <span class={`pill ${statusClass(thread.status)}`}>{thread.status}</span> : null}
        {!thread.status ? <span class="pill">{TYPE_LABEL[thread.type]}</span> : null}
        {stale ? <span class="pill">Quiet</span> : null}
      </div>
      <a class="headline" href={href} rel="noopener nofollow">{thread.top.title}</a>
      <div class="meta">
        <span>{thread.top.sourceName}</span>
        <time dateTime={thread.top.at}>{timeAgo(thread.top.at, now)}</time>
        {thread.itemCount > 1 ? <span>{thread.itemCount} reports, {thread.sourceCount} {thread.sourceCount === 1 ? 'source' : 'sources'}</span> : null}
        {thread.teams.slice(0, 6).map((team) => (
          <a class="team-chip" href={`${base}team/${team.toLowerCase()}/`} key={team}>{team}</a>
        ))}
      </div>
    </li>
  );
}

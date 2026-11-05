import type { APIRoute } from 'astro';
import { TEAM_BY_ABBR, TEAMS } from '../../core/teams';
import { toApiThreads } from '../../lib/api';
import { atomFeed } from '../../lib/atom';
import { latest, threads as allThreads } from '../../lib/data';

export function getStaticPaths() {
  return [{ params: { feed: 'all' } }, ...TEAMS.map((team) => ({ params: { feed: team.abbr.toLowerCase() } }))];
}

export const GET: APIRoute = ({ params, site }) => {
  const key = String(params.feed);
  const team = TEAM_BY_ABBR.get(key.toUpperCase());
  const siteUrl = new URL(import.meta.env.BASE_URL.replace(/\/?$/, '/'), site).toString();
  const reporterThreads = toApiThreads(allThreads, siteUrl);
  const threads = team ? reporterThreads.filter((thread) => thread.teams.includes(team.abbr)) : reporterThreads;
  const body = atomFeed({
    title: team ? `Bullpen Phone: ${team.name} reporter posts` : 'Bullpen Phone: reporter posts',
    selfUrl: `${siteUrl}feeds/${key}.xml`,
    siteUrl,
    updated: latest.generatedAt,
    threads,
  });
  return new Response(body, { headers: { 'content-type': 'application/atom+xml; charset=utf-8' } });
};

import type { APIRoute } from 'astro';
import { TEAM_BY_ABBR, TEAMS } from '../../core/teams';
import { atomFeed } from '../../lib/atom';
import { latest } from '../../lib/data';

export function getStaticPaths() {
  return [{ params: { feed: 'all' } }, ...TEAMS.map((team) => ({ params: { feed: team.abbr.toLowerCase() } }))];
}

export const GET: APIRoute = ({ params, site }) => {
  const key = String(params.feed);
  const team = TEAM_BY_ABBR.get(key.toUpperCase());
  const siteUrl = new URL(import.meta.env.BASE_URL.replace(/\/?$/, '/'), site).toString();
  const threads = team ? latest.threads.filter((thread) => thread.teams.includes(team.abbr)) : latest.threads;
  const body = atomFeed({
    title: team ? `Hot Stove: ${team.name}` : 'Hot Stove: all threads',
    selfUrl: `${siteUrl}feeds/${key}.xml`,
    siteUrl,
    updated: latest.generatedAt,
    threads,
  });
  return new Response(body, { headers: { 'content-type': 'application/atom+xml; charset=utf-8' } });
};

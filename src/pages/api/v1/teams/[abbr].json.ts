import type { APIRoute } from 'astro';
import { TEAMS } from '../../../../core/teams';
import { envelope, siteRoot, toApiThreads } from '../../../../lib/api';
import { latest, threads } from '../../../../lib/data';

export function getStaticPaths() {
  return TEAMS.map((team) => ({ params: { abbr: team.abbr.toLowerCase() }, props: { team } }));
}

export const GET: APIRoute = ({ props, site }) =>
  envelope(latest.generatedAt, {
    team: { abbr: props.team.abbr, name: props.team.name, division: props.team.division },
    threads: toApiThreads(threads, siteRoot(site)).filter((thread) => thread.teams.includes(props.team.abbr)),
  });

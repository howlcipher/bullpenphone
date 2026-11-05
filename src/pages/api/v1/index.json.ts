import type { APIRoute } from 'astro';
import { TEAMS } from '../../../core/teams';
import { envelope, siteRoot } from '../../../lib/api';
import { latest } from '../../../lib/data';

export const GET: APIRoute = ({ site }) => {
  const root = `${siteRoot(site)}api/v1/`;
  return envelope(latest.generatedAt, {
    endpoints: {
      threads: `${root}threads.json`,
      thread: `${root}threads/{id}.json`,
      team: `${root}teams/{team}.json`,
      openapi: `${root}openapi.json`,
    },
    teams: TEAMS.map((team) => ({ abbr: team.abbr, name: team.name, division: team.division })),
    statuses: ['Linked', 'Interest', 'Talks', 'Agreement reported', 'Fell through', 'Unclassified'],
    threadTypes: ['player', 'team', 'staff', 'league'],
    updates: 'Check meta.generatedAt for freshness. Updates are scheduled every 10 minutes but can run late.',
  });
};

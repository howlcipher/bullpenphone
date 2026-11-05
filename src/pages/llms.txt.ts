import type { APIRoute } from 'astro';
import { USAGE, siteRoot } from '../lib/api';

export const GET: APIRoute = ({ site }) => {
  const root = siteRoot(site);
  return new Response(
    `# Bullpen Phone

> Automated, unofficial tracker of MLB trades, free agents and front office moves.

Use the API below rather than reading the site's pages. The API holds public posts by MLB reporters on Bluesky. Other sources on the site are not licensed for AI use, so please don't collect them from its pages.

${USAGE}

Statuses are assigned by software and aren't confirmation that a move happened. Check meta.generatedAt for freshness.

## API

- [Index](${root}api/v1/index.json): endpoints, clubs and statuses
- [All threads](${root}api/v1/threads.json): newest first
- [One club](${root}api/v1/teams/chc.json): lowercase club abbreviation
- [One thread](${root}api/v1/threads/{id}.json): by thread id
- [OpenAPI spec](${root}api/v1/openapi.json): for tool and agent setup
- [Documentation](${root}api/)
`,
    { headers: { 'content-type': 'text/plain; charset=utf-8' } },
  );
};

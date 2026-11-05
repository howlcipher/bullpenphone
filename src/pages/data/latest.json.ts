import type { APIRoute } from 'astro';
import { latest } from '../../lib/data';

export const GET: APIRoute = () => new Response(JSON.stringify(latest), { headers: { 'content-type': 'application/json' } });

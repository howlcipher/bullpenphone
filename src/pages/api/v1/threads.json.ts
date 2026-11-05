import type { APIRoute } from 'astro';
import { envelope, siteRoot, toApiThreads } from '../../../lib/api';
import { latest, threads } from '../../../lib/data';

export const GET: APIRoute = ({ site }) => envelope(latest.generatedAt, toApiThreads(threads, siteRoot(site)));

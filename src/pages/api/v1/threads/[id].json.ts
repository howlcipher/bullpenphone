import type { APIRoute } from 'astro';
import { envelope, siteRoot, toApiThread, type ApiThread } from '../../../../lib/api';
import { latest, threads } from '../../../../lib/data';

export function getStaticPaths() {
  return threads.filter((thread) => toApiThread(thread, 'https://x/')).map((thread) => ({ params: { id: thread.id }, props: { thread } }));
}

export const GET: APIRoute = ({ props, site }) => envelope(latest.generatedAt, toApiThread(props.thread, siteRoot(site)) as ApiThread);

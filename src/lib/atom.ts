import type { ThreadSummary } from '../core/schemas';

export const xmlEscape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

export function atomFeed(options: { title: string; selfUrl: string; siteUrl: string; updated: string; threads: ThreadSummary[] }): string {
  const entries = options.threads
    .slice(0, 50)
    .map((thread) => {
      const url = `${options.siteUrl}t/${thread.id}/`;
      return `<entry><id>${xmlEscape(url)}#${xmlEscape(thread.top.at)}</id><title>${xmlEscape(`${thread.subject}: ${thread.top.title}`)}</title><link href="${xmlEscape(url)}"/><updated>${xmlEscape(thread.top.at)}</updated><summary>${xmlEscape(`${thread.status ?? thread.type} via ${thread.top.sourceName}`)}</summary><author><name>${xmlEscape(thread.top.sourceName)}</name></author></entry>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${xmlEscape(options.selfUrl)}</id><title>${xmlEscape(options.title)}</title><link rel="self" href="${xmlEscape(options.selfUrl)}"/><link href="${xmlEscape(options.siteUrl)}"/><updated>${xmlEscape(options.updated)}</updated>${entries}</feed>`;
}

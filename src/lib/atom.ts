import type { ApiThread } from './api';

export const xmlEscape = (value: string): string =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');

/** Feeds republish their content, so like the API they carry Bluesky reporter posts only. */
export function atomFeed(options: { title: string; selfUrl: string; siteUrl: string; updated: string; threads: ApiThread[] }): string {
  const entries = options.threads
    .slice(0, 50)
    .map((thread) => {
      const report = thread.reports.find((entry) => entry.role === 'primary') ?? thread.reports[0];
      return `<entry><id>${xmlEscape(thread.page)}#${xmlEscape(report.publishedAt)}</id><title>${xmlEscape(`${thread.subject}: ${report.text}`)}</title><link href="${xmlEscape(report.url)}"/><link rel="related" href="${xmlEscape(thread.page)}"/><updated>${xmlEscape(report.publishedAt)}</updated><summary>${xmlEscape(`${thread.status ?? thread.type}, reported by ${report.reporter}`)}</summary><author><name>${xmlEscape(report.reporter)}</name></author></entry>`;
    })
    .join('');
  return `<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><id>${xmlEscape(options.selfUrl)}</id><title>${xmlEscape(options.title)}</title><link rel="self" href="${xmlEscape(options.selfUrl)}"/><link href="${xmlEscape(options.siteUrl)}"/><updated>${xmlEscape(options.updated)}</updated>${entries}</feed>`;
}

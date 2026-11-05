import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'yaml';
import * as z from 'zod/mini';
import { isHttpsUrl } from '../core/schemas';

const root = process.env.BULLPENPHONE_ROOT ?? process.cwd();
const load = (name: string): unknown => parse(readFileSync(resolve(root, 'config', name), 'utf8'));

const feedSchema = z.object({
  id: z.string(),
  name: z.string(),
  url: z.string().check(z.refine(isHttpsUrl)),
  reviewed: z.boolean(),
  excluded: z.optional(z.boolean()),
  notes: z.optional(z.string()),
});
const reporterSchema = z.object({ handle: z.string(), name: z.string(), identity: z.enum(['verified', 'pending']) });
const overridesSchema = z.object({
  threads: z.record(z.string(), z.object({ status: z.optional(z.string()), hidden: z.optional(z.boolean()) })),
  items: z.object({ hide: z.array(z.string()) }),
});
const gatesSchema = z.object({ agreement_reported: z.boolean(), fell_through: z.boolean() });
const aliasSchema = z.object({ match: z.string(), team: z.optional(z.string()), mlbamId: z.number(), name: z.string() });

export type Feed = z.infer<typeof feedSchema>;
export type Reporter = z.infer<typeof reporterSchema>;
export type Overrides = z.infer<typeof overridesSchema>;
export type Gates = z.infer<typeof gatesSchema>;

export const loadFeeds = () => z.object({ feeds: z.array(feedSchema) }).parse(load('sources.yaml')).feeds;
export const loadReporters = () => z.object({ reporters: z.array(reporterSchema) }).parse(load('reporters.yaml')).reporters;
export const loadOverrides = () => overridesSchema.parse(load('overrides.yaml'));
export const loadGates = () => gatesSchema.parse(load('gates.yaml'));
export const loadAliases = () => z.object({ aliases: z.array(aliasSchema) }).parse(load('aliases.yaml')).aliases;
export const loadNotice = () => z.object({ notice: z.optional(z.string()) }).parse(load('site.yaml')).notice ?? '';

/** Excluded sources never run. Unreviewed sources never reach a published build. */
export function publishableFeeds(feeds: Feed[], includeUnreviewed: boolean): Feed[] {
  return feeds.filter((feed) => !feed.excluded && (feed.reviewed || includeUnreviewed));
}
export function publishableReporters(reporters: Reporter[], includeUnreviewed: boolean): Reporter[] {
  return reporters.filter((reporter) => reporter.identity === 'verified' || includeUnreviewed);
}

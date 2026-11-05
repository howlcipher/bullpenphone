import * as z from 'zod/mini';

export const isHttpsUrl = (value: string): boolean => {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
};

const httpsUrl = z.string().check(z.refine(isHttpsUrl, 'must be an https URL'));
const title = z.string().check(z.minLength(1), z.maxLength(600));

export const STATUSES = ['Linked', 'Interest', 'Talks', 'Agreement reported', 'Fell through', 'Unclassified'] as const;
export const statusSchema = z.enum(STATUSES);
export type Status = z.infer<typeof statusSchema>;

export const THREAD_TYPES = ['player', 'team', 'staff', 'league'] as const;
export const threadTypeSchema = z.enum(THREAD_TYPES);
export type ThreadType = z.infer<typeof threadTypeSchema>;

// Strict on purpose: an unexpected field, such as article text, fails the run.
export const itemSchema = z.strictObject({
  id: z.string(),
  title,
  url: httpsUrl,
  sourceId: z.string(),
  sourceName: z.string(),
  sourceKind: z.enum(['news', 'reporter', 'fansite']),
  author: z.optional(z.string()),
  publishedAt: z.string(),
  firstSeenAt: z.string(),
  role: z.enum(['primary', 'mention']),
  status: z.nullable(statusSchema),
  teams: z.array(z.string()),
});
export type Item = z.infer<typeof itemSchema>;

export const dealSchema = z.object({
  threadId: z.string(),
  player: z.string(),
  teams: z.array(z.string()),
  years: z.nullable(z.number()),
  amountUsd: z.nullable(z.number()),
  minor: z.boolean(),
  title,
  url: httpsUrl,
  sourceName: z.string(),
  at: z.string(),
});
export type Deal = z.infer<typeof dealSchema>;

export const threadSchema = z.object({
  id: z.string(),
  type: threadTypeSchema,
  subject: z.string(),
  mlbamId: z.nullable(z.number()),
  teams: z.array(z.string()),
  status: z.nullable(statusSchema),
  statusAt: z.nullable(z.string()),
  firstSeenAt: z.string(),
  lastActivityAt: z.string(),
  items: z.array(itemSchema),
});
export type Thread = z.infer<typeof threadSchema>;

export const sourceHealthSchema = z.object({
  id: z.string(),
  name: z.string(),
  lastSuccessAt: z.nullable(z.string()),
  lastError: z.nullable(z.string()),
  etag: z.optional(z.string()),
  lastModified: z.optional(z.string()),
});
export type SourceHealth = z.infer<typeof sourceHealthSchema>;

export const stateSchema = z.object({
  version: z.literal(1),
  updatedAt: z.string(),
  threads: z.record(z.string(), threadSchema),
  deals: z.array(dealSchema),
  health: z.record(z.string(), sourceHealthSchema),
});
export type State = z.infer<typeof stateSchema>;

export const threadSummarySchema = z.object({
  id: z.string(),
  type: threadTypeSchema,
  subject: z.string(),
  mlbamId: z.nullable(z.number()),
  teams: z.array(z.string()),
  status: z.nullable(statusSchema),
  firstSeenAt: z.string(),
  lastActivityAt: z.string(),
  itemCount: z.number(),
  sourceCount: z.number(),
  top: z.object({ title, url: httpsUrl, sourceName: z.string(), at: z.string() }),
});
export type ThreadSummary = z.infer<typeof threadSummarySchema>;

export const latestSchema = z.object({
  version: z.literal(1),
  generatedAt: z.string(),
  threads: z.array(threadSummarySchema),
});
export type Latest = z.infer<typeof latestSchema>;

export const emptyState = (now: string): State => ({ version: 1, updatedAt: now, threads: {}, deals: [], health: {} });

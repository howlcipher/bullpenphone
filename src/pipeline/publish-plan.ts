import { createHash } from 'node:crypto';

/** The ID git gives a file's contents, used to skip files that haven't changed. */
export function gitBlobSha(content: Buffer): string {
  return createHash('sha1').update(`blob ${content.length}\0`).update(content).digest('hex');
}

export interface PublishPlan {
  add: string[];
  remove: string[];
}

/** Compares the built site with the published branch. Both map path to git blob ID. */
export function planPublish(local: Map<string, string>, remote: Map<string, string>): PublishPlan {
  const add = [...local.keys()].filter((path) => local.get(path) !== remote.get(path)).sort();
  const remove = [...remote.keys()].filter((path) => !local.has(path)).sort();
  return { add, remove };
}

import { existsSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { gitBlobSha, planPublish } from '../../src/pipeline/publish-plan';

describe('site publishing', () => {
  it('computes the same file IDs as git', () => {
    expect(gitBlobSha(Buffer.from(''))).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
    expect(gitBlobSha(Buffer.from('hello\n'))).toBe('ce013625030ba8dba906f756967f9e9ca394464a');
  });
  it('sends only changes, and removes files no longer in the site', () => {
    const local = new Map([['same.html', 'a'], ['changed.html', 'new'], ['added.html', 'c']]);
    const remote = new Map([['same.html', 'a'], ['changed.html', 'old'], ['stale.html', 'd']]);
    expect(planPublish(local, remote)).toEqual({ add: ['added.html', 'changed.html'], remove: ['stale.html'] });
    expect(planPublish(local, local)).toEqual({ add: [], remove: [] });
  });
  it('keeps Jekyll from dropping the _astro folder', () => {
    expect(existsSync('public/.nojekyll')).toBe(true);
  });
});

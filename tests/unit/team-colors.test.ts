import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TEAMS } from '../../src/core/teams';

const css = readFileSync('src/styles/global.css', 'utf8');
const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string): number => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('club pennants', () => {
  it.each(TEAMS.map((team) => team.abbr))('%s has readable colors', (abbr) => {
    const match = css.match(new RegExp(`\\.team-${abbr.toLowerCase()} \\{ background: (#[0-9A-Fa-f]{6}); color: (#[0-9A-Fa-f]{6}); \\}`));
    expect(match, abbr).not.toBeNull();
    expect(contrast(match![1], match![2])).toBeGreaterThanOrEqual(4.5);
  });
});

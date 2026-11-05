/** Minimal robots.txt check for the wildcard user agent: longest matching rule wins. */
export function isAllowedByRobots(robotsTxt: string, path: string): boolean {
  const rules: Array<{ allow: boolean; pattern: string }> = [];
  let applies = false;
  let lastWasAgent = false;
  for (const raw of robotsTxt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const separator = line.indexOf(':');
    if (separator < 0) continue;
    const field = line.slice(0, separator).trim().toLowerCase();
    const value = line.slice(separator + 1).trim();
    if (field === 'user-agent') {
      const isWild = value === '*';
      applies = lastWasAgent ? applies || isWild : isWild;
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if (applies && (field === 'allow' || field === 'disallow') && value) {
      rules.push({ allow: field === 'allow', pattern: value });
    }
  }
  let best: { allow: boolean; length: number } = { allow: true, length: -1 };
  for (const rule of rules) {
    const source = rule.pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    const regex = new RegExp(`^${source.endsWith('\\$') ? `${source.slice(0, -2)}$` : source}`);
    if (regex.test(path) && rule.pattern.length > best.length) best = { allow: rule.allow, length: rule.pattern.length };
  }
  return best.allow;
}

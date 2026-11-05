export const STALE_DAYS = 21;

export function isStale(lastActivityAt: string, now: number): boolean {
  return now - Date.parse(lastActivityAt) > STALE_DAYS * 86_400_000;
}

export function timeAgo(iso: string, now: number): string {
  const seconds = Math.max(0, (now - Date.parse(iso)) / 1000);
  if (seconds < 90) return 'just now';
  const minutes = seconds / 60;
  if (minutes < 60) return `${Math.round(minutes)} min ago`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours)} hr ago`;
  const days = hours / 24;
  if (days < 30) return `${Math.round(days)} d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
}

export const statusClass = (status: string | null): string => (status ? `status-${status.toLowerCase().replace(/\s+/g, '-')}` : '');

export const usd = (amount: number): string =>
  amount >= 1e9 ? `$${(amount / 1e9).toFixed(2).replace(/\.?0+$/, '')}B` : `$${(amount / 1e6).toFixed(1).replace(/\.0$/, '')}M`;

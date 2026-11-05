import { useEffect, useState } from 'preact/hooks';
import { timeAgo } from '../core/display';
import { looksLikeRumor } from '../core/extract';

interface Reporter { handle: string; name: string }
interface Post { id: string; text: string; url: string; at: string; name: string; teams: string[] }

const POLL_MS = 120_000;
const SAFE_KEY = /^[a-z0-9]+$/i;
const MAX_AGE_MS = 72 * 3_600_000;

async function load(reporter: Reporter, now: number): Promise<Post[]> {
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${encodeURIComponent(reporter.handle)}&limit=10&filter=posts_no_replies`;
  const response = await fetch(url, { credentials: 'omit' });
  if (!response.ok) throw new Error(String(response.status));
  const body = (await response.json()) as { feed?: Array<{ reason?: unknown; post?: { uri?: string; indexedAt?: string; record?: { text?: unknown; createdAt?: unknown } } }> };
  const posts: Post[] = [];
  for (const entry of body.feed ?? []) {
    if (entry.reason || !entry.post) continue;
    const key = entry.post.uri?.split('/').pop();
    const text = entry.post.record?.text;
    const at = entry.post.record?.createdAt ?? entry.post.indexedAt;
    if (!key || !SAFE_KEY.test(key) || typeof text !== 'string' || typeof at !== 'string') continue;
    if (now - Date.parse(at) > MAX_AGE_MS) continue;
    const check = looksLikeRumor(text);
    if (!check.relevant) continue;
    posts.push({ id: key, text: text.length > 240 ? `${text.slice(0, 240)}…` : text, url: `https://bsky.app/profile/${reporter.handle}/post/${key}`, at, name: reporter.name, teams: check.teams });
  }
  return posts;
}

export default function LivePosts({ reporters }: { reporters: Reporter[] }) {
  const [posts, setPosts] = useState<Post[]>([]);
  const [state, setState] = useState<'loading' | 'ok' | 'failed'>('loading');
  const [now, setNow] = useState(0);

  useEffect(() => {
    let active = true;
    const refresh = async () => {
      const at = Date.now();
      const results = await Promise.allSettled(reporters.map((reporter) => load(reporter, at)));
      if (!active) return;
      const ok = results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));
      const failedAll = results.length > 0 && results.every((result) => result.status === 'rejected');
      setPosts(ok.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 8));
      setState(failedAll ? 'failed' : 'ok');
      setNow(at);
    };
    void refresh();
    const timer = setInterval(() => {
      if (document.visibilityState === 'visible') void refresh();
    }, POLL_MS);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, []);

  if (state === 'failed' || reporters.length === 0) return null;
  return (
    <section class="panel" aria-labelledby="live-heading">
      <h2 id="live-heading">Newest from reporters</h2>
      <p class="note">Recent Bluesky posts that look market-related, filtered automatically. Not yet checked or grouped.</p>
      {state === 'loading' ? <p class="note">Loading…</p> : null}
      {state === 'ok' && posts.length === 0 ? <p class="note">No market posts in the last three days.</p> : null}
      <ul aria-live="polite">
        {posts.map((post) => (
          <li key={post.id}>
            <a href={post.url} rel="noopener nofollow">{post.text}</a>
            <div class="meta"><span>{post.name}</span><time dateTime={post.at}>{timeAgo(post.at, now)}</time></div>
          </li>
        ))}
      </ul>
    </section>
  );
}

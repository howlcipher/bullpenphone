import { useEffect, useRef, useState } from 'preact/hooks';

interface PagefindResult { data: () => Promise<{ url: string; meta: { title?: string }; excerpt: string }> }
interface Pagefind { search: (query: string) => Promise<{ results: PagefindResult[] }> }
interface Hit { url: string; title: string; excerpt: string }

const stripTags = (value: string): string => value.replace(/<[^>]*>/g, '');

export default function Search({ base }: { base: string }) {
  const engine = useRef<Pagefind | null>(null);
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [state, setState] = useState<'idle' | 'failed'>('idle');
  const [searched, setSearched] = useState(false);

  useEffect(() => {
    const term = query.trim();
    if (!term) {
      setHits([]);
      setSearched(false);
      return;
    }
    let active = true;
    const timer = setTimeout(async () => {
      try {
        if (!engine.current) {
          const path = `${base}pagefind/pagefind.js`;
          engine.current = (await import(/* @vite-ignore */ path)) as Pagefind;
        }
        const found = await engine.current.search(term);
        const data = await Promise.all(found.results.slice(0, 25).map((result) => result.data()));
        if (active) {
          setHits(data.map((entry) => ({ url: entry.url, title: entry.meta.title ?? entry.url, excerpt: stripTags(entry.excerpt) })));
          setSearched(true);
        }
      } catch {
        if (active) setState('failed');
      }
    }, 200);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query]);

  return (
    <div>
      <label class="field">Player, team or topic
        <input type="search" value={query} onInput={(event) => setQuery(event.currentTarget.value)} />
      </label>
      {state === 'failed' ? <p class="empty">Search isn't available right now.</p> : null}
      <p class="meta" aria-live="polite">{searched ? `${hits.length} ${hits.length === 1 ? 'result' : 'results'}` : ''}</p>
      <ul class="card-list">
        {hits.map((hit) => (
          <li class="card" key={hit.url}>
            <a class="subject" href={hit.url}>{hit.title}</a>
            <p class="meta">{hit.excerpt}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * DEV-ONLY music engine for the Glassnik feed.
 *
 * Ported (in a much smaller form) from Bhargav's prototype
 * (github.com/bjsy10101978-del/Glassnik_music_prototype). It picks a track from the
 * pool that matches the video's Category, and keeps the same track playing while the
 * viewer stays inside the same category.
 *
 * The catalogue and the MP3 files are streamed from the prototype's public GitHub repo,
 * so nothing is bundled into the app. NOTE: the licences of those tracks are NOT
 * verified yet - this must never ship in a release build.
 */
const BASE =
  'https://raw.githubusercontent.com/bjsy10101978-del/Glassnik_music_prototype/main/';

export interface MusicTrack {
  id: string;
  uri: string;
  categories: string[];
}

// App category label (upload/Explore list) -> music taxonomy id.
// Anything not listed uses the "general" pool. PROPOSED mapping - needs review.
const CATEGORY_MAP: Record<string, string> = {
  'city walks': 'walking',
  'local life': 'markets',
  'peaceful places': 'wellness',
  'food & markets': 'markets',
  'cafes': 'cafes',
  'shopping': 'shopping',
  'architecture & landmarks': 'architecture',
  'museums & galleries': 'museums',
  'parks & gardens': 'parks',
  'beaches & coastlines': 'beaches',
  'nature & scenery': 'nature',
  'trails & hiking': 'hiking',
  'adventure': 'adventure',
  'rides & transport': 'cycling',
  'scenic drives': 'road_trips',
  'sports': 'adventure',
  'events & festivals': 'festivals',
  'music & performance': 'festivals',
  'sacred places': 'historic_sites',
  'after dark': 'nightlife',
  // short labels used by the mock server's test videos
  'food': 'dining',
  'beach': 'beaches',
  'city': 'walking',
};

/** One music "context" per category. Same key = keep playing, new key = new track. */
export function contextKeyFor(appCategory?: string | null): string {
  const k = (appCategory ?? '').trim().toLowerCase();
  return CATEGORY_MAP[k] ?? 'general';
}

let cache: MusicTrack[] | null = null;

export async function loadCatalogue(): Promise<MusicTrack[]> {
  if (cache) return cache;
  const res = await fetch(BASE + 'data/catalogue.json');
  if (!res.ok) throw new Error('Music catalogue request failed: ' + res.status);
  const json = await res.json();
  cache = (json.tracks as any[])
    .filter((t) => !!t.file_reference)
    .map((t) => ({
      id: String(t.track_id),
      uri: BASE + 'public/' + t.file_reference,
      categories: Array.isArray(t.categories) ? t.categories : [],
    }));
  return cache;
}

/**
 * Picks a track for the context. Never the same song twice in a row, and avoids the
 * last 15 played while any other track exists in the pool.
 */
export function pickTrack(
  tracks: MusicTrack[],
  key: string,
  history: string[],
): MusicTrack | null {
  let pool =
    key === 'general'
      ? tracks.filter((t) => t.categories.length === 0)
      : tracks.filter((t) => t.categories.includes(key));
  if (pool.length === 0) pool = tracks.filter((t) => t.categories.length === 0);
  if (pool.length === 0) pool = tracks;
  if (pool.length === 0) return null;

  const last = history[history.length - 1];
  let fresh = pool.filter((t) => !history.includes(t.id));
  if (fresh.length === 0) fresh = pool.filter((t) => t.id !== last);
  if (fresh.length === 0) fresh = pool;
  return fresh[Math.floor(Math.random() * fresh.length)];
}
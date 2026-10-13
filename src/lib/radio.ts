import { getHistory, type RadioSession } from './player';
import type { SavedRadio } from './radios';
import {
  type Album, type Song,
  getAlbum, getAlbumList, getArtist, getRandomSongs, getSimilarArtists, getSimilarSongs, getTopSongs,
} from './subsonic';

// Radio = a walk over the "related artists" graph (genre tags are unreliable here, so they're only a tiebreak).
//  1. Crawl getArtistInfo2 outwards from the seed(s) a few hops, a beam of the best nodes per hop.
//     Score accumulates over every path, so an artist reached from several neighbours outranks a one-off.
//  2. Song-level similarity (getSimilarSongs2) bridges artists the graph can't reach (sparse neighbours).
//  3. Pull tracks from the best artists, then sequence with weighted sampling, artist cooldown and per-artist caps.
//  4. The same machinery lazily extends the queue while it plays, so a radio never ends.

export type RadioSeed =
  | { kind: 'song'; song: Song }
  | { kind: 'artist'; id: string; name: string }
  | { kind: 'album'; album: Album }
  | { kind: 'mix' };

type Node = { id: string; name: string; score: number; depth: number; expanded: boolean; fetched: boolean };

const HOPS = 3;
const BEAM = 14;
const DECAY = 0.6;
const POOL = 6;
const MAX_PER_ARTIST = 4;
const COOLDOWN = 3;

const simCache = new Map<string, Awaited<ReturnType<typeof getSimilarArtists>>>();
const similar = async (id: string) => {
  const hit = simCache.get(id);
  if (hit) return hit;
  let list = await getSimilarArtists(id, 20).catch(() => []);
  simCache.set(id, list);
  return list;
};

async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(n, items.length) }, async () => {
      while (i < items.length) {
        const k = i++;
        out[k] = await fn(items[k]);
      }
    }),
  );
  return out;
}

async function seedArtists(seed: RadioSeed): Promise<{ id: string; name: string }[]> {
  if (seed.kind === 'song') return seed.song.artistId ? [{ id: seed.song.artistId, name: seed.song.artist ?? '' }] : [];
  if (seed.kind === 'artist') return [{ id: seed.id, name: seed.name }];
  if (seed.kind === 'album') {
    // Compilations/untagged albums have a junk album-artist; seed from the artists of the actual tracks instead.
    const junk = /various|unknown|^va$/i;
    const direct = seed.album.artistId && !junk.test(seed.album.artist ?? '') ? [{ id: seed.album.artistId, name: seed.album.artist ?? '' }] : [];
    if (direct.length) return direct;
    const { songs } = await getAlbum(seed.album.id).catch(() => ({ songs: [] as Song[] }));
    const count = new Map<string, { id: string; name: string; n: number }>();
    for (const s of songs) {
      if (!s.artistId || junk.test(s.artist ?? '')) continue;
      const e = count.get(s.artistId) ?? { id: s.artistId, name: s.artist ?? '', n: 0 };
      e.n++;
      count.set(s.artistId, e);
    }
    return [...count.values()].sort((a, b) => b.n - a.n).slice(0, 6).map(({ id, name }) => ({ id, name }));
  }
  // mix: artists you actually play (frequent albums + recent plays)
  const freq = await getAlbumList('frequent', 12).catch(() => []);
  const recent = await getAlbumList('recent', 8).catch(() => []);
  const seen = new Map<string, string>();
  for (const a of [...freq, ...recent]) if (a.artistId && !seen.has(a.artistId)) seen.set(a.artistId, a.artist ?? '');
  return [...seen].slice(0, 5).map(([id, name]) => ({ id, name }));
}

export async function buildRadio(
  seed: RadioSeed,
  onProgress: (msg: string) => void = () => {},
  budgetMs = 45_000,
): Promise<{ session: RadioSession; first: Song[] }> {
  const t0 = Date.now();
  const left = () => budgetMs - (Date.now() - t0);
  const nodes = new Map<string, Node>();
  const direct: Song[] = []; // songs from song-level similarity
  const hist = new Set(getHistory().slice(0, 40));
  let seedGenre: string | undefined;

  const seeds = await seedArtists(seed);
  for (const s of seeds) nodes.set(s.id, { ...s, score: 1, depth: 0, expanded: false, fetched: false });

  const label =
    seed.kind === 'song' ? `${seed.song.title} radio`
    : seed.kind === 'artist' ? `${seed.name} radio`
    : seed.kind === 'album' ? `${seed.album.name} radio`
    : 'Daily mix';

  // -- 1. graph crawl -----------------------------------------------------------
  async function crawl(maxHops: number) {
    for (let hop = 1; hop <= maxHops && left() > 5000; hop++) {
      const frontier = [...nodes.values()]
        .filter((n) => !n.expanded)
        .sort((a, b) => b.score - a.score)
        .slice(0, hop === 1 ? 10 : BEAM);
      if (!frontier.length) break;
      onProgress(`Mapping related artists… hop ${hop} (${nodes.size} found)`);
      const lists = await pool(frontier, POOL, (n) => similar(n.id));
      frontier.forEach((parent, pi) => {
        parent.expanded = true;
        const list = lists[pi];
        list.forEach((a, rank) => {
          const gain = parent.score * DECAY * (1 - rank / (list.length + 4));
          const ex = nodes.get(a.id);
          if (ex) ex.score += gain;
          else nodes.set(a.id, { id: a.id, name: a.name, score: gain, depth: parent.depth + 1, expanded: false, fetched: false });
        });
      });
    }
  }

  // -- 2. song-level similarity -------------------------------------------------
  async function songSimilarity() {
    let ids = seed.kind === 'song' ? [seed.song.id] : seeds.map((s) => s.id);
    if (seed.kind === 'song') seedGenre = seed.song.genre;
    if (seed.kind === 'album') {
      seedGenre = seed.album.genre;
      const { songs } = await getAlbum(seed.album.id).catch(() => ({ songs: [] as Song[] }));
      ids = [...songs.slice(0, 3).map((x) => x.id), ...ids]; // real track ids work even when the album artist is junk
    }
    onProgress('Finding similar tracks…');
    const lists = await pool(ids.slice(0, 4), 4, (id) => getSimilarSongs(id, 50).catch(() => [] as Song[]));
    for (const list of lists) {
      for (const s of list) {
        direct.push(s);
        if (!s.artistId) continue;
        const n = nodes.get(s.artistId);
        if (n) n.score += 0.12;
        else nodes.set(s.artistId, { id: s.artistId, name: s.artist ?? '', score: 0.12, depth: 1, expanded: false, fetched: false });
      }
    }
  }

  await Promise.all([crawl(HOPS), songSimilarity()]);

  // -- 3. gather tracks ---------------------------------------------------------
  const candidates = new Map<string, { song: Song; w: number }>();
  const seedIds = new Set(seeds.map((s) => s.id));
  const addCandidates = (songs: Song[], artistScore: number, boost = 1) => {
    for (const s of songs) {
      if (candidates.has(s.id)) continue;
      let w = Math.pow(Math.max(artistScore, 0.05), 0.8) * (0.6 + 0.4 * Math.random()) * boost;
      if (s.starred) w += 0.15;
      if (seedGenre && s.genre === seedGenre) w += 0.04; // weak: tags are noisy
      if (hist.has(s.id)) w *= 0.3;
      candidates.set(s.id, { song: s, w });
    }
  };
  addCandidates(direct, 0.8, 1.1);

  async function songsForArtist(n: Node): Promise<Song[]> {
    n.fetched = true;
    let songs = await getTopSongs(n.name, 12);
    if (songs.length < 6) {
      try {
        const { albums } = await getArtist(n.id);
        const picks = [...albums].sort(() => Math.random() - 0.5).slice(0, 3);
        const more = await Promise.all(picks.map((a) => getAlbum(a.id).then((r) => r.songs).catch(() => [] as Song[])));
        const seen = new Set(songs.map((s) => s.id));
        for (const s of more.flat()) if (!seen.has(s.id)) songs.push(s);
      } catch {}
    }
    return songs;
  }

  async function fetchArtists(count: number) {
    const batch = [...nodes.values()].filter((n) => !n.fetched).sort((a, b) => b.score - a.score).slice(0, count);
    if (!batch.length) return 0;
    onProgress(`Picking tracks from ${batch.length} artists…`);
    const res = await pool(batch, POOL, songsForArtist);
    batch.forEach((n, i) => addCandidates(res[i], seedIds.has(n.id) ? Math.max(n.score, 1) : n.score));
    return batch.length;
  }

  await fetchArtists(28);

  // Thin pool (sparse graph / compilation seed): top up so the radio is never a one-track dead end.
  if (candidates.size < 30) {
    onProgress('Few related artists — widening the search…');
    const fill = await getRandomSongs(80, seedGenre ? { genre: seedGenre } : {}).catch(() => [] as Song[]);
    addCandidates(fill, 0.12);
    if (candidates.size < 30) addCandidates(await getRandomSongs(80).catch(() => [] as Song[]), 0.08);
  }

  // -- 4. sequencing ------------------------------------------------------------
  const perArtist = new Map<string, number>();
  const recentArtists: string[] = [];
  let sequenceSeedFirst = seed.kind === 'song' ? seed.song : undefined;

  function pickBatch(n: number): Song[] {
    const out: Song[] = [];
    if (sequenceSeedFirst) {
      out.push(sequenceSeedFirst);
      candidates.delete(sequenceSeedFirst.id);
      recentArtists.push(sequenceSeedFirst.artistId ?? '');
      perArtist.set(sequenceSeedFirst.artistId ?? '', 1);
      sequenceSeedFirst = undefined;
    }
    while (out.length < n && candidates.size) {
      const eligible = [...candidates.values()].filter(({ song }) => {
        const a = song.artistId ?? song.artist ?? '';
        return (perArtist.get(a) ?? 0) < MAX_PER_ARTIST && !recentArtists.slice(-COOLDOWN).includes(a);
      });
      const poolList = eligible.length ? eligible : [...candidates.values()];
      const total = poolList.reduce((t, c) => t + c.w, 0);
      let r = Math.random() * total;
      let chosen = poolList[0];
      for (const c of poolList) {
        r -= c.w;
        if (r <= 0) { chosen = c; break; }
      }
      candidates.delete(chosen.song.id);
      const a = chosen.song.artistId ?? chosen.song.artist ?? '';
      perArtist.set(a, (perArtist.get(a) ?? 0) + 1);
      recentArtists.push(a);
      out.push(chosen.song);
    }
    return out;
  }

  const first = pickBatch(40);
  onProgress(`Ready — ${first.length} tracks from ${new Set(first.map((s) => s.artistId)).size} artists`);

  let growing = false;
  const session: RadioSession = {
    label,
    async more(count) {
      if (growing) return [];
      growing = true;
      try {
        // refill: next-best unfetched artists, else crawl one hop further, else give caps a fresh start
        for (let attempt = 0; attempt < 3 && candidates.size < count; attempt++) {
          if (!(await fetchArtists(12))) {
            await crawl(1);
            if (![...nodes.values()].some((n) => !n.fetched)) perArtist.clear();
          }
        }
        if (candidates.size < count) addCandidates(await getRandomSongs(60, seedGenre ? { genre: seedGenre } : {}).catch(() => [] as Song[]), 0.1);
        return pickBatch(count);
      } finally {
        growing = false;
      }
    },
  };
  return { session, first };
}

// Replays a saved radio instantly; the artist-graph crawl only runs when the queue needs extending.
export function resumeRadio(saved: SavedRadio): RadioSession {
  let built: Awaited<ReturnType<typeof buildRadio>> | null = null;
  const seen = new Set(saved.songs.map((x) => x.id));
  return {
    label: saved.label,
    async more(count) {
      if (!built) {
        built = await buildRadio(saved.seed);
        return built.first.filter((x) => !seen.has(x.id)).slice(0, count);
      }
      return built.session.more(count);
    },
  };
}

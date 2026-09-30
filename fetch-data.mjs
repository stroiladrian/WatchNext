// Fetches new/popular movies + shows from TMDB (free key) and the Rotten Tomatoes
// score from OMDb (free key, 1000 req/day). Writes data.json. Node 18+.
// Usage: TMDB_KEY=xxx OMDB_KEY=yyy node fetch-data.mjs
import { readFile, writeFile } from 'node:fs/promises';

const TMDB = process.env.TMDB_KEY, OMDB = process.env.OMDB_KEY;
if (!TMDB) { console.error('Missing TMDB_KEY'); process.exit(1); }
const REGION = process.env.REGION || 'RO', LANG = 'ro-RO';
const IMG = 'https://image.tmdb.org/t/p/w342';
const MAX = +(process.env.MAX_PER_TYPE || 40);

const tmdb = async (path, params = {}) => {
  const u = new URL('https://api.themoviedb.org/3' + path);
  u.search = new URLSearchParams({ api_key: TMDB, language: LANG, ...params });
  const r = await fetch(u); if (!r.ok) throw new Error(path + ' ' + r.status);
  return r.json();
};

let old = { movies: [], tv: [] };
try { old = JSON.parse(await readFile('data.json', 'utf8')); } catch {}
const cache = new Map([...old.movies, ...old.tv].map(x => [x.key, x]));
let omdbCalls = 0, omdbDead = false;

async function rtScore(imdb, key) {
  const prev = cache.get(key);
  const fresh = prev && prev.rtAt && Date.now() - prev.rtAt < 3 * 864e5;
  if (fresh || !OMDB || !imdb || omdbDead) return { rt: prev?.rt ?? null, rtAt: prev?.rtAt };
  omdbCalls++;
  try {
    const j = await (await fetch(`https://www.omdbapi.com/?i=${imdb}&apikey=${OMDB}`)).json();
    if (/limit/i.test(j.Error || '')) { omdbDead = true; return { rt: prev?.rt ?? null, rtAt: prev?.rtAt }; }
    const v = (j.Ratings || []).find(r => r.Source === 'Rotten Tomatoes')?.Value;
    return { rt: v ? parseInt(v) : null, rtAt: Date.now() };
  } catch { return { rt: prev?.rt ?? null, rtAt: prev?.rtAt }; }
}

async function collect(type) {
  const lists = type === 'movie'
    ? [['/movie/now_playing', { region: REGION }], ['/movie/upcoming', { region: REGION }], ['/trending/movie/week']]
    : [['/tv/on_the_air'], ['/tv/airing_today'], ['/trending/tv/week']];
  const seen = new Map();
  for (const [p, extra] of lists) {
    const j = await tmdb(p, extra);
    for (const x of j.results) if (!seen.has(x.id) && x.poster_path) seen.set(x.id, x);
  }
  const items = [...seen.values()].sort((a, b) => b.popularity - a.popularity).slice(0, MAX);
  const out = [];
  for (const x of items) {
    const d = await tmdb(`/${type}/${x.id}`, { append_to_response: 'external_ids' });
    const key = `${type}:${x.id}`;
    const { rt, rtAt } = await rtScore(d.external_ids?.imdb_id, key);
    const mins = type === 'movie' ? d.runtime : d.episode_run_time?.[0];
    out.push({
      key, title: d.title || d.name, overview: d.overview || x.overview,
      poster: IMG + x.poster_path,
      date: d.release_date || d.first_air_date,
      year: (d.release_date || d.first_air_date || '').slice(0, 4),
      runtime: mins ? (mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`) : (type === 'tv' && d.number_of_seasons ? `${d.number_of_seasons} sez.` : ''),
      genres: (d.genres || []).map(g => g.name),
      tmdb: d.vote_average ? +d.vote_average.toFixed(1) : null,
      popularity: x.popularity, rt, rtAt,
    });
  }
  return out;
}

const movies = await collect('movie'), tv = await collect('tv');
await writeFile('data.json', JSON.stringify({ updated: new Date().toISOString(), movies, tv }));
console.log(`OK: ${movies.length} filme, ${tv.length} seriale, ${omdbCalls} apeluri OMDb`);

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
let omdbCalls = 0, omdbDead = false, omdbError = null, noRt = 0;

async function rtScore(imdb, key) {
  const prev = cache.get(key);
  const keep = { rt: prev?.rt ?? null, rtAt: prev?.rtAt };
  const ttl = prev?.rt != null ? 3 * 864e5 : 864e5;
  if ((prev?.rtAt && Date.now() - prev.rtAt < ttl) || !OMDB || !imdb || omdbDead) return keep;
  omdbCalls++;
  try {
    const j = await (await fetch(`https://www.omdbapi.com/?i=${imdb}&apikey=${OMDB}`)).json();
    if (j.Response === 'False') {            // key/limit problem: do not cache, stop hammering
      omdbError = j.Error || 'unknown OMDb error';
      if (/key|limit/i.test(omdbError)) omdbDead = true;
      return keep;
    }
    const v = (j.Ratings || []).find(r => r.Source === 'Rotten Tomatoes')?.Value;
    if (!v) noRt++;
    return { rt: v ? parseInt(v) : null, rtAt: Date.now() };
  } catch (e) { omdbError = String(e.message || e); return keep; }
}

// normalise TMDB provider names so "Netflix Standard with Ads" and "Netflix" become one chip
const PROV_RENAME = { 'Amazon Prime Video': 'Prime Video', 'Amazon Video': 'Prime Video', 'Disney Plus': 'Disney+', 'Apple TV Plus': 'Apple TV+', 'Apple TV': 'Apple TV+', 'HBO Max': 'HBO Max', 'Max': 'HBO Max' };
const normProv = n => { const s = n.replace(/\s+(Standard )?with Ads$/i, '').trim(); return PROV_RENAME[s] || s; };
const dstr = off => new Date(Date.now() + off * 864e5).toISOString().slice(0, 10);

async function collect(type) {
  const lists = type === 'movie'
    ? [['/movie/now_playing', { region: REGION }], ['/discover/movie', { sort_by: 'popularity.desc', 'primary_release_date.gte': dstr(-120), 'primary_release_date.lte': dstr(30) }], ['/discover/movie', { page: 2, sort_by: 'popularity.desc', 'primary_release_date.gte': dstr(-120), 'primary_release_date.lte': dstr(30) }], ['/movie/upcoming', { region: REGION }], ['/trending/movie/week']]
    : [['/tv/on_the_air'], ['/discover/tv', { sort_by: 'popularity.desc', 'first_air_date.gte': dstr(-240) }], ['/discover/tv', { page: 2, sort_by: 'popularity.desc', 'first_air_date.gte': dstr(-240) }], ['/tv/airing_today'], ['/trending/tv/week']];
  const seen = new Map();
  for (const [p, extra] of lists) {
    const j = await tmdb(p, extra);
    for (const x of j.results) if (!seen.has(x.id) && x.poster_path) seen.set(x.id, x);
  }
  const now = Date.now(), day = 864e5;
  const dateOf = x => Date.parse(x.release_date || x.first_air_date || '') || 0;
  const recent = x => type === 'movie'
    ? dateOf(x) >= now - 120 * day && dateOf(x) <= now + 30 * day
    : dateOf(x) >= now - 240 * day && dateOf(x) <= now + 30 * day;
  const items = [...seen.values()].filter(recent).sort((a, b) => b.popularity - a.popularity).slice(0, MAX);
  const out = [];
  for (const x of items) {
    const d = await tmdb(`/${type}/${x.id}`, { append_to_response: 'external_ids,watch/providers' });
    const key = `${type}:${x.id}`;
    let overview = d.overview || x.overview;
    if (!overview) overview = (await tmdb(`/${type}/${x.id}`, { language: 'en-US' })).overview || '';
    const { rt, rtAt } = await rtScore(d.external_ids?.imdb_id, key);
    const wp = d['watch/providers']?.results?.[REGION];
    const providers = [...new Set([...(wp?.flatrate || []), ...(wp?.ads || []), ...(wp?.free || [])].map(p => normProv(p.provider_name)))];
    const mins = type === 'movie' ? d.runtime : d.episode_run_time?.[0];
    out.push({
      key, title: d.title || d.name, overview,
      poster: IMG + x.poster_path,
      date: d.release_date || d.first_air_date,
      year: (d.release_date || d.first_air_date || '').slice(0, 4),
      runtime: mins ? (mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`) : (type === 'tv' && d.number_of_seasons ? `${d.number_of_seasons} sez.` : ''),
      genres: (d.genres || []).map(g => g.name),
      tmdb: d.vote_average ? +d.vote_average.toFixed(1) : null, votes: d.vote_count || 0,
      popularity: x.popularity, providers, rt, rtAt,
    });
  }
  return out;
}

const movies = await collect('movie'), tv = await collect('tv');
// only rewrite (=> new commit + Pages rebuild) when the content actually changed
const sig = o => JSON.stringify([o.movies, o.tv, o.omdbError ?? null]);
if (sig(old) !== sig({ movies, tv, omdbError })) await writeFile('data.json', JSON.stringify({ updated: new Date().toISOString(), omdbError, movies, tv }));
else console.log('Fara schimbari.');
console.log(`OK: ${movies.length} filme, ${tv.length} seriale, ${omdbCalls} apeluri OMDb, fara RT: ${noRt}, eroare OMDb: ${omdbError || 'nu'}`);

const $ = s => document.querySelector(s);
const state = { type: 'movie', sort: 'rt', min: 0, provider: '', genre: '', data: { movie: [], tv: [] } };

const fmtDate = d => d ? new Date(d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// Rotten Tomatoes % when known, otherwise the TMDB audience score (x10) so every title is rankable
const MIN_VOTES = 30;
const audience = it => (it.tmdb && (it.votes ?? 0) >= MIN_VOTES ? it.tmdb : null);
const score = it => it.rt ?? (audience(it) != null ? audience(it) * 10 : null);

function badge(it) {
  if (it.rt != null) return `<span class="badge"><i class="dot ${it.rt < 60 ? 'rot' : ''}"></i>${it.rt}%</span>`;
  if (audience(it) != null) return `<span class="badge" title="Scor audiență TMDB (fără scor Rotten Tomatoes)"><span class="star">★</span>${it.tmdb}</span>`;
  return '<span class="badge"><i class="dot none"></i>--</span>';
}

function card(it, i) {
  const img = it.poster ? `<img src="${esc(it.poster)}" alt="">` : esc(it.title);
  const meta = [it.year, it.runtime].filter(Boolean).join(' · ');
  return `<button class="card" data-i="${i}">
    <div class="poster">${img}</div>
    <div class="t">${esc(it.title)}</div>
    <div class="m"><span class="meta">${esc(meta)}</span>${badge(it)}</div></button>`;
}

// TMDB names genres differently for films/series ("SF & Fantasy", "Acţiune & Aventuri", cedilla diacritics): split + normalise
const GENRE_FIX = { 'Animaţie': 'Animație', 'Acţiune': 'Acțiune', 'Science Fiction': 'SF' };
const genresOf = it => [...new Set((it.genres || []).flatMap(g => g.split(' & ')).map(g => GENRE_FIX[g.trim()] || g.trim()).filter(Boolean))];
const byProvider = list => list
  .filter(x => !state.provider || (x.providers || []).includes(state.provider))
  .filter(x => !state.genre || genresOf(x).includes(state.genre));

function renderGenres() {
  const counts = {};
  state.data[state.type].forEach(x => genresOf(x).forEach(g => { counts[g] = (counts[g] || 0) + 1; }));
  const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  if (state.genre && !counts[state.genre]) state.genre = '';
  $('#genreGroup').hidden = names.length === 0;
  $('#genreChips').innerHTML = `<button data-g="" class="${state.genre ? '' : 'on'}">Toate</button>` +
    names.map(n => `<button data-g="${esc(n)}" class="${state.genre === n ? 'on' : ''}">${esc(n)}<span class="n">${counts[n]}</span></button>`).join('');
}

function renderProviders() {
  const counts = {};
  state.data[state.type].forEach(x => (x.providers || []).forEach(p => { counts[p] = (counts[p] || 0) + 1; }));
  const names = Object.keys(counts).sort((a, b) => counts[b] - counts[a] || a.localeCompare(b));
  if (state.provider && !counts[state.provider]) state.provider = '';
  $('#provGroup').hidden = names.length === 0;
  $('#provChips').innerHTML = `<button data-p="" class="${state.provider ? '' : 'on'}">Toate</button>` +
    names.map(n => `<button data-p="${esc(n)}" class="${state.provider === n ? 'on' : ''}">${esc(n)}<span class="n">${counts[n]}</span></button>`).join('');
}

function renderFilterBtn() {
  const n = (state.min ? 1 : 0) + (state.provider ? 1 : 0) + (state.genre ? 1 : 0) + (state.sort !== 'rt' ? 1 : 0);
  $('#fCount').hidden = n === 0; $('#fCount').textContent = n;
  $('#fBtn').classList.toggle('active', n > 0 && $('#filters').hidden);
  $('#fBtn').classList.toggle('open', !$('#filters').hidden);
  $('#fBtn').setAttribute('aria-expanded', String(!$('#filters').hidden));
  $('#resetF').hidden = n === 0;
}

function filtered() {
  let list = byProvider(state.data[state.type]).slice();
  if (state.min) list = list.filter(x => (score(x) ?? -1) >= state.min);
  const by = {
    rt: (a, b) => (score(b) ?? -1) - (score(a) ?? -1),
    new: (a, b) => (b.date || '').localeCompare(a.date || ''),
    pop: (a, b) => (b.popularity || 0) - (a.popularity || 0),
  }[state.sort];
  return list.sort(by);
}

function render() {
  renderProviders();
  renderGenres();
  const list = filtered();
  $('#listTitle').textContent = state.type === 'movie' ? 'Toate Filmele' : 'Toate Serialele';
  $('#grid').innerHTML = list.map(card).join('');
  $('#empty').hidden = list.length > 0;
  const top = byProvider(state.data[state.type]).filter(x => score(x) != null).sort((a, b) => score(b) - score(a)).slice(0, 6);
  $('#heroSec').hidden = top.length === 0;
  $('#hero').innerHTML = top.map((it, i) => card(it, 'h' + i)).join('');
  $('#hero').__top = top;
  $('#grid').__list = list;
  renderFilterBtn();
}

function open(it) {
  const img = it.poster ? `<img src="${esc(it.poster)}" alt="">` : esc(it.title);
  $('#sheet').innerHTML = `<button class="close" aria-label="Închide">×</button>
    <div class="big"><div class="poster">${img}</div>
    <div><h3>${esc(it.title)}</h3>
    <div class="meta">${esc([fmtDate(it.date), it.runtime, genresOf(it).join(', ')].filter(Boolean).join(' · '))}</div>
    <div class="score">${it.rt != null ? `<span>🍅 ${it.rt}%</span>` : ''}${it.tmdb ? `<span>★ ${it.tmdb}</span>` : ''}</div></div></div>
    ${(it.providers || []).length ? `<div class="avail">Disponibil pe: <b>${esc(it.providers.join(', '))}</b></div>` : ''}
    ${it.overview ? `<p>${esc(it.overview)}</p>` : ''}
    <a class="rt" target="_blank" rel="noopener" href="https://www.rottentomatoes.com/search?search=${encodeURIComponent(it.title)}">Vezi pe Rotten Tomatoes →</a>`;
  $('#modal').hidden = false;
}

document.addEventListener('click', e => {
  const c = e.target.closest('.card');
  if (c) {
    const i = c.dataset.i;
    open(String(i).startsWith('h') ? $('#hero').__top[+i.slice(1)] : $('#grid').__list[+i]);
    return;
  }
  if (e.target.closest('.close') || e.target.id === 'modal') $('#modal').hidden = true;
});

$('#tabs').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.type = b.dataset.type;
  document.querySelectorAll('#tabs button').forEach(x => x.classList.toggle('on', x === b));
  render();
});
$('#fBtn').onclick = () => { $('#filters').hidden = !$('#filters').hidden; renderFilterBtn(); };
$('#provChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.provider = b.dataset.p;
  render();
});
$('#genreChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.genre = b.dataset.g;
  render();
});
$('#resetF').onclick = () => {
  state.sort = 'rt'; state.min = 0; state.provider = ''; state.genre = '';
  document.querySelectorAll('#sortChips button').forEach(x => x.classList.toggle('on', x.dataset.s === 'rt'));
  document.querySelectorAll('#minChips button').forEach(x => x.classList.toggle('on', x.dataset.m === '0'));
  render();
};
$('#sortChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.sort = b.dataset.s;
  document.querySelectorAll('#sortChips button').forEach(x => x.classList.toggle('on', x === b));
  render();
});
$('#minChips').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b) return;
  state.min = +b.dataset.m;
  document.querySelectorAll('#minChips button').forEach(x => x.classList.toggle('on', x === b));
  render();
});

let lastSig = '';
function load() {
  return fetch('data.json', { cache: 'no-cache' })
    .then(r => r.json())
    .then(d => {
      if (d.updated) $('#updated').textContent = 'Actualizat ' + new Date(d.updated).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
      if (d.demo) $('#updated').textContent = 'Date demo – rulează scriptul de update';
      const sig = JSON.stringify([d.movies, d.tv]);
      if (sig === lastSig) return;              // nothing new: leave the page untouched
      lastSig = sig;
      state.data = { movie: d.movies || [], tv: d.tv || [] };
      render();
    })
    .catch(() => { if (!lastSig) { $('#empty').hidden = false; $('#empty').textContent = 'Nu s-au putut încărca datele.'; } });
}
const EVERY = 18 * 60 * 1000;
let lastLoad = Date.now();
load();
setInterval(() => { lastLoad = Date.now(); load(); }, EVERY);
document.addEventListener('visibilitychange', () => {   // returning to a tab that slept in the background
  if (!document.hidden && Date.now() - lastLoad >= EVERY) { lastLoad = Date.now(); load(); }
});

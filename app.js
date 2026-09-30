const $ = s => document.querySelector(s);
const state = { type: 'movie', sort: 'rt', min: 0, q: '', data: { movie: [], tv: [] } };

const fmtDate = d => d ? new Date(d).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

function badge(rt) {
  if (rt == null) return '<span class="badge"><i class="dot none"></i>--</span>';
  return `<span class="badge"><i class="dot ${rt < 60 ? 'rot' : ''}"></i>${rt}%</span>`;
}

function card(it, i) {
  const img = it.poster ? `<img src="${esc(it.poster)}" alt="">` : esc(it.title);
  const meta = [it.year, it.runtime].filter(Boolean).join(' · ');
  return `<button class="card" data-i="${i}">
    <div class="poster">${img}${badge(it.rt)}</div>
    <div class="t">${esc(it.title)}</div>
    <div class="m">${esc(meta)}</div></button>`;
}

function filtered() {
  let list = state.data[state.type].slice();
  const q = state.q.trim().toLowerCase();
  if (q) list = list.filter(x => x.title.toLowerCase().includes(q));
  if (state.min) list = list.filter(x => (x.rt ?? -1) >= state.min);
  const by = {
    rt: (a, b) => (b.rt ?? -1) - (a.rt ?? -1),
    new: (a, b) => (b.date || '').localeCompare(a.date || ''),
    pop: (a, b) => (b.popularity || 0) - (a.popularity || 0),
  }[state.sort];
  return list.sort(by);
}

function render() {
  const list = filtered();
  $('#listTitle').textContent = state.type === 'movie' ? 'Toate Filmele' : 'Toate Serialele';
  $('#grid').innerHTML = list.map(card).join('');
  $('#empty').hidden = list.length > 0;
  const top = state.data[state.type].filter(x => x.rt != null).sort((a, b) => b.rt - a.rt).slice(0, 6);
  $('#heroSec').hidden = !!state.q || top.length === 0;
  $('#hero').innerHTML = top.map((it, i) => card(it, 'h' + i)).join('');
  $('#hero').__top = top;
  $('#grid').__list = list;
}

function open(it) {
  const img = it.poster ? `<img src="${esc(it.poster)}" alt="">` : esc(it.title);
  $('#sheet').innerHTML = `<button class="close" aria-label="Închide">×</button>
    <div class="big"><div class="poster">${img}</div>
    <div><h3>${esc(it.title)}</h3>
    <div class="meta">${esc([fmtDate(it.date), it.runtime, (it.genres || []).join(', ')].filter(Boolean).join(' · '))}</div>
    <div class="score"><span>🍅 ${it.rt != null ? it.rt + '%' : '--'}</span>${it.tmdb ? `<span>★ ${it.tmdb}</span>` : ''}</div></div></div>
    <p>${esc(it.overview || 'Fără descriere.')}</p>
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
  $('#heroSub').textContent = state.type === 'movie' ? 'Cele mai bine cotate din noutăți' : 'Cele mai bine cotate seriale noi';
  render();
});
$('#fBtn').onclick = () => { $('#filters').hidden = !$('#filters').hidden; };
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
$('#q').addEventListener('input', e => { state.q = e.target.value; render(); });

fetch('data.json', { cache: 'no-cache' })
  .then(r => r.json())
  .then(d => {
    state.data = { movie: d.movies || [], tv: d.tv || [] };
    if (d.updated) $('#updated').textContent = 'Actualizat ' + new Date(d.updated).toLocaleString('ro-RO', { dateStyle: 'medium', timeStyle: 'short' });
    if (d.demo) $('#updated').textContent = 'Date demo – rulează scriptul de update';
    render();
  })
  .catch(() => { $('#empty').hidden = false; $('#empty').textContent = 'Nu s-au putut încărca datele.'; });

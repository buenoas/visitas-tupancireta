'use strict';
/* Visitas Tupanciretã — IFFar Campus Júlio de Castilhos
   Serve para duas coisas: saber onde cada aluno mora e montar o roteiro de visitas
   (Google Maps e impressão/PDF). Tudo roda no celular, com as ruas do OpenStreetMap (ruas.js). */

const CAMPUS = [-29.18167, -53.71464];
const CENTRO = [-29.08129, -53.83648];           // Igreja Matriz (marco do centro)
const REFS = [
  { n: 'Igreja Matriz', p: [-29.08129, -53.83648] },
  { n: 'Prefeitura', p: [-29.08492, -53.83656] },
];
const COR = '#c62828', COR_FORA = '#8a968e';
const RURAL = [
  [/nova tup/, [-29.0894, -53.7985], 'Assentamento Nova Tupã'],
  [/conquista/, [-29.0433, -53.8473], 'Assentamento Conquista da Esperança'],
  [/santa rosa|rsc 392/, [-29.0300, -53.8442], 'Assentamento Santa Rosa'],
];

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { const v = localStorage.getItem('vt.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('vt.' + k, JSON.stringify(v)); } catch (e) { } },
  del(k) { try { localStorage.removeItem('vt.' + k); } catch (e) { } },
};
const agora = () => new Date().toISOString();
const dataBR = iso => { if (!iso) return ''; const d = new Date(iso); return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }); };
const deac = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
function toast(msg, ms = 2600) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), ms);
}
const KX = 111320 * Math.cos(29.08 * Math.PI / 180), KY = 110574;
const xy = p => [p[1] * KX, p[0] * KY];
const ll = (x, y) => [y / KY, x / KX];
const dist = (a, b) => { const A = xy(a), B = xy(b); return Math.hypot(A[0] - B[0], A[1] - B[1]); };
const ICON = {
  maps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.5"/></svg>',
  tel: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.9v3a2 2 0 0 1-2.2 2A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>',
  zap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21l1.7-5A8.5 8.5 0 1 1 8 19.4z"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v8H6z"/></svg>',
  mail: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 6-10 7L2 6"/></svg>',
  gps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="7"/></svg>',
};

/* ---------- estado ---------- */
let DB = null, A = [], byId = {};
let sel = LS.get('sel', []);
let filtro = { q: '', bairro: '', curso: LS.get('curso', ''), ordem: 'nome' };
let ENTRADA = null;

function salvarSel() { LS.set('sel', sel); atualizarBolhas(); }

/* ---------- dados dos alunos ----------
   Não ficam no site público. Chegam por um link (#d=..., parte do endereço que o navegador
   não envia ao servidor) ou por um arquivo, e ficam guardados só neste celular. */
async function dadosDoLink() {
  const m = location.hash.match(/^#d=([A-Za-z0-9_-]+)/); if (!m) return null;
  const b64 = m[1].replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(b64 + '==='.slice((b64.length + 3) % 4)), c => c.charCodeAt(0));
  const txt = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text();
  return JSON.parse(txt);
}
function dadosValidos(d) { return d && d.app === 'visitas-tupancireta' && Array.isArray(d.alunos); }
function guardarDados(d) {
  const atual = LS.get('dados', null);
  if (!atual || (d.gerado || '') >= (atual.gerado || '')) LS.set('dados', d);
}
async function obterDados() {
  try {
    const d = await dadosDoLink();
    if (dadosValidos(d)) { guardarDados(d); toast(`Lista de alunos carregada (${d.alunos.length})`); }
  } catch (e) { toast('O link de dados veio incompleto. Peça o link de novo ou use o arquivo.'); }
  if (location.hash.startsWith('#d=')) history.replaceState(null, '', location.pathname + location.search);
  const salvo = LS.get('dados', null);
  if (dadosValidos(salvo)) return salvo;
  if (dadosValidos(window.DADOS)) return window.DADOS;
  return null;
}

/* ---------- ruas (OpenStreetMap) e localização dos endereços ---------- */
const STOPW = new Set('rua r av avenida travessa tv trav beco estrada rodovia prl prolongamento numero n nao informado outros viela corredor de da do das dos e'.split(' '));
const TITW = new Set('doutor dr vereador ver coronel cel padre pe capitao cap general gal gen professora professor prof profa presidente pres major maj senador sen expedicionario dom dona frei'.split(' '));
const toks = s => deac(s).replace(/[^a-z0-9]+/g, ' ').trim().split(' ').filter(t => t && !STOPW.has(t) && !TITW.has(t));

function lev(a, b) {
  const m = a.length, n = b.length; if (!m || !n) return Math.max(m, n);
  let p = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const c = [i];
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = c;
  }
  return p[n];
}
const parecido = (a, b) => a === b || (a.length > 3 && b.length > 3 && 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.8);

let WAYS = [], RUAS_K = new Map(), DF = {};
function carregarRuas() {
  const R = window.RUAS;
  WAYS = R.ways.map(s => {
    const [ni, hw, c] = s.split(';'); const v = c.split(',').map(Number); const pts = [];
    let a = 0, o = 0; for (let i = 0; i < v.length; i += 2) { a += v[i]; o += v[i + 1]; pts.push([a / 1e5, o / 1e5]); }
    const [name, ref] = R.names[+ni].split('|');
    return { name, ref, hw, pts };
  });
  for (const w of WAYS) {
    if (!w.name) continue;
    const t = toks(w.name); if (!t.length) continue;
    if (/^(beco|viela)\b/i.test(w.name)) t.unshift('beco');   // beco não se confunde com a rua de mesmo nome
    const k = t.join(' ');
    if (!RUAS_K.has(k)) RUAS_K.set(k, { k, t, nomes: {}, ways: [] });
    const s = RUAS_K.get(k); s.ways.push(w); s.nomes[w.name] = (s.nomes[w.name] || 0) + 1;
  }
  for (const s of RUAS_K.values()) {
    s.nome = Object.keys(s.nomes).sort((a, b) => s.nomes[b] - s.nomes[a] || b.length - a.length)[0];
    new Set(s.t).forEach(t => DF[t] = (DF[t] || 0) + 1);
    eixo(s);
  }
  // entrada da cidade pela RS-527: o ponto da rodovia mais próximo do campus
  let best = 1e12;
  for (const w of WAYS) if ((w.ref || '').includes('527')) for (const p of w.pts) { const d = dist(p, CAMPUS); if (d < best) { best = d; ENTRADA = p; } }
  if (!ENTRADA) ENTRADA = [-29.0706, -53.8178];
}
// eixo principal da rua: a numeração começa na ponta mais perto do centro (metros a partir do início)
function eixo(s) {
  const P = []; s.ways.forEach(w => w.pts.forEach(p => P.push(xy(p))));
  const mx = P.reduce((a, p) => a + p[0], 0) / P.length, my = P.reduce((a, p) => a + p[1], 0) / P.length;
  let sxx = 0, syy = 0, sxy = 0; for (const [x, y] of P) { sxx += (x - mx) ** 2; syy += (y - my) ** 2; sxy += (x - mx) * (y - my); }
  const th = 0.5 * Math.atan2(2 * sxy, sxx - syy); let ux = Math.cos(th), uy = Math.sin(th);
  let tmin = 1e9, tmax = -1e9; for (const [x, y] of P) { const t = (x - mx) * ux + (y - my) * uy; tmin = Math.min(tmin, t); tmax = Math.max(tmax, t); }
  const C = xy(CENTRO);
  const d0 = Math.hypot(mx + tmin * ux - C[0], my + tmin * uy - C[1]), d1 = Math.hypot(mx + tmax * ux - C[0], my + tmax * uy - C[1]);
  if (d1 < d0) { ux = -ux; uy = -uy; const t = tmin; tmin = -tmax; tmax = -t; }
  s.ax = { mx, my, ux, uy, t0: tmin, len: tmax - tmin };
}
function encostar(s, X, Y) { // ponto mais próximo sobre a rua
  let best = null, bd = 1e12;
  for (const w of s.ways) for (let i = 0; i < w.pts.length - 1; i++) {
    const [ax, ay] = xy(w.pts[i]), [bx, by] = xy(w.pts[i + 1]);
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let t = L ? ((X - ax) * dx + (Y - ay) * dy) / L : 0; t = Math.max(0, Math.min(1, t));
    const px = ax + t * dx, py = ay + t * dy, d = Math.hypot(px - X, py - Y);
    if (d < bd) { bd = d; best = [px, py]; }
  }
  return ll(best[0], best[1]);
}
function pontoNaRua(s, num) {
  const a = s.ax;
  if (!(num > 0)) return encostar(s, a.mx, a.my);
  const t = a.t0 + Math.min(num, a.len);
  return encostar(s, a.mx + t * a.ux, a.my + t * a.uy);
}
function nota(t, u) {
  const usados = new Set(); let m = 0; const casados = [];
  for (const x of t) {
    for (let j = 0; j < u.length; j++) {
      if (usados.has(j)) continue;
      if (x.length <= 3 ? x === u[j] : parecido(x, u[j])) { usados.add(j); m++; casados.push(u[j]); break; }
    }
  }
  if (!m) return 0;
  let s = 2 * m / (t.length + u.length);
  const quase = (a, b) => a === b || (a.length > 3 && b.length > 3 && 1 - lev(a, b) / Math.max(a.length, b.length) >= 0.7);
  if (t.length > 1 && u.length > 1 && quase(t[0], u[0]) && quase(t[t.length - 1], u[u.length - 1])) s = Math.max(s, 0.75);
  if (m >= 2 && m === Math.min(t.length, u.length)) s = Math.max(s, 0.8);
  if (casados.some(x => x.length >= 7 && DF[x] === 1)) s = Math.max(s, 0.65);
  return s;
}
function acharRua(texto) {
  const t = toks(texto); if (!t.length) return null;
  const k = t.join(' ');
  if (RUAS_K.has(k)) return RUAS_K.get(k);
  let best = null, bn = 0;
  for (const s of RUAS_K.values()) { const n = nota(t, s.t); if (n > bn) { bn = n; best = s; } }
  return bn >= 0.62 ? best : null;
}
function localizarTodos() {
  const porBairro = {};
  for (const a of A) {
    a.numN = /^\d+$/.test(a.num) && +a.num > 0 ? +a.num : 0;
    const tudo = deac([a.lg, a.r, a.b, a.cp].join(' '));
    const ruralForte = /assentamento|localidade|rodovia|br 158|rsc 392|linha |lageado|km \d/.test(tudo);
    const rural = ruralForte || /interior/.test(tudo);
    a.geo = { p: null, prec: '', rua: '' };
    const s = ruralForte ? null : acharRua(a.r);   // "Interior" com rua da cidade: vale a rua
    if (rural && !s) {
      const z = RURAL.find(([re]) => re.test(tudo));
      if (z) a.geo = { p: z[1], prec: 'rural', rua: z[2] };
      else a.geo = { p: null, prec: 'semlocal', rua: '' };
    } else if (!a.r.trim() && !a.b.trim()) {
      a.geo = { p: null, prec: 'semlocal', rua: '' };
    } else {
      if (s) {
        a.geo = { p: pontoNaRua(s, a.numN), prec: a.numN ? 'numero' : 'rua', rua: s.nome };
        const bk = deac(a.b).trim(); if (bk) (porBairro[bk] = porBairro[bk] || []).push(a.geo.p);
      }
    }
  }
  for (const a of A) {
    if (a.geo.p || a.geo.prec) continue;
    const ps = porBairro[deac(a.b).trim()];
    if (ps && ps.length) a.geo = { p: [ps.reduce((s, p) => s + p[0], 0) / ps.length, ps.reduce((s, p) => s + p[1], 0) / ps.length], prec: 'bairro', rua: '' };
    else a.geo = { p: CENTRO, prec: 'bairro', rua: '' };
  }
  aplicarLocais();
}
function aplicarLocais() {
  for (const a of A) {
    const fix = DB.locais && DB.locais[a.id];
    if (fix && fix.length === 2) a.geo = Object.assign({}, a.geo, { p: fix, prec: 'gps' });
  }
}
const PREC = {
  gps: 'Local confirmado no GPS', numero: 'Local estimado pelo número da casa', rua: 'Casa sem número: ponto no meio da rua',
  bairro: 'Rua não encontrada no mapa: ponto aproximado do bairro', rural: 'Zona rural: ponto aproximado da localidade', semlocal: 'Zona rural sem localização no mapa',
};

/* ---------- textos de endereço ---------- */
function endTxt(a, curto) {
  const rua = [a.lg, a.r].filter(Boolean).join(' ');
  const num = a.num && a.num !== '0' && a.num !== '00' ? ', ' + a.num : '';
  const cp = a.cp && !/^casa$/i.test(a.cp) ? ' - ' + a.cp : '';
  return curto ? rua + num : rua + num + cp;
}
function destinoMaps(a) {
  const g = a.geo;
  if (g.prec === 'gps' || g.prec === 'rural' || g.prec === 'rua') return g.p.map(v => v.toFixed(6)).join(',');
  if (g.prec === 'numero') return `${g.rua}, ${a.numN} - Tupanciretã, RS`;
  return `${endTxt(a, true)} - ${a.b ? a.b + ', ' : ''}Tupanciretã, RS`;
}
function linkMaps(origem, paradas) {
  const dest = paradas[paradas.length - 1], wps = paradas.slice(0, -1);
  let u = 'https://www.google.com/maps/dir/?api=1&travelmode=driving';
  if (origem) u += '&origin=' + encodeURIComponent(origem);
  u += '&destination=' + encodeURIComponent(dest);
  if (wps.length) u += '&waypoints=' + encodeURIComponent(wps.join('|'));
  return u;
}

/* ---------- filtros ---------- */
function passa(a) {
  if (filtro.bairro && a.bK !== filtro.bairro) return false;
  if (filtro.curso && a.c !== filtro.curso) return false;
  if (filtro.q) {
    const q = deac(filtro.q).trim().split(/\s+/);
    const alvo = deac([a.n, a.r, a.geo.rua, a.b, a.c, a.num].join(' '));
    if (!q.every(p => alvo.includes(p))) return false;
  }
  return true;
}
function filtrados() {
  const L = A.filter(passa);
  if (filtro.ordem === 'nome') L.sort((x, y) => x.n.localeCompare(y.n, 'pt'));
  else L.sort((x, y) => (x.bL || 'zzz').localeCompare(y.bL || 'zzz', 'pt') || (x.geo.rua || x.r).localeCompare(y.geo.rua || y.r, 'pt') || x.numN - y.numN);
  return L;
}

/* ---------- tela: alunos ---------- */
function renderLista() {
  const L = filtrados();
  $('#contagem').textContent = filtro.curso || filtro.bairro || filtro.q ? `${L.length} de ${A.length} alunos` : `${A.length} alunos`;
  const ns = new Set(sel);
  const todosMarcados = L.length && L.every(a => ns.has(a.id));
  $('#bt-add-todos').textContent = todosMarcados ? 'desmarcar todos' : 'marcar todos';
  if (!L.length) { $('#lista').innerHTML = '<div class="vazio">Nenhum aluno com esses filtros.</div>'; atualizarBarra(); return; }
  $('#lista').innerHTML = L.map(a => {
    const pos = sel.indexOf(a.id);
    return `<div class="card" data-id="${a.id}">
      <button class="chk" aria-pressed="${ns.has(a.id)}" aria-label="Incluir no roteiro"><span>${pos >= 0 ? pos + 1 : ''}</span></button>
      <button class="corpo">
        <div class="nome">${esc(a.n)}</div>
        <div class="sub">${esc(a.c)}${a.t ? ' · ' + esc(a.t) : ''}</div>
        <div class="end">${esc(endTxt(a))}</div>
        <div class="tags">${a.b ? `<span class="tag">${esc(a.b)}</span>` : ''}
          ${a.geo.prec === 'bairro' || a.geo.prec === 'semlocal' || a.geo.prec === 'rural' ? '<span class="tag aviso">local aproximado</span>' : ''}</div>
      </button></div>`;
  }).join('');
  atualizarBarra();
}
function atualizarBarra() {
  const ver = telaAtual === 'alunos' && sel.length > 0;
  $('#barra-sel').classList.toggle('hide', !ver);
  document.body.classList.toggle('com-barra', ver);
  $('#bs-n').textContent = `${sel.length} aluno${sel.length > 1 ? 's' : ''} marcado${sel.length > 1 ? 's' : ''}`;
}
function montarRoteiro() {
  if (!sel.length) return;
  sel = ordenarRota(sel); salvarSel(); irPara('roteiro');
}
function montarFiltros() {
  const bairros = {};
  for (const a of A) { a.bK = deac(a.b).replace(/^bairro\s+/, '').replace(/\s+/g, ' ').trim(); a.bL = a.b.replace(/^Bairro\s+/i, ''); if (a.bK) bairros[a.bK] = bairros[a.bK] || a.bL; }
  const bs = Object.entries(bairros).sort((x, y) => x[1].localeCompare(y[1], 'pt'));
  $('#f-bairro').innerHTML = '<option value="">Todos os bairros</option>' + bs.map(([k, l]) => `<option value="${esc(k)}">${esc(l)} (${A.filter(a => a.bK === k).length})</option>`).join('');
  const cursos = [...new Set(A.map(a => a.c))].sort((x, y) => x.localeCompare(y, 'pt'));
  $('#f-curso').innerHTML = `<option value="">Todos os cursos (${A.length})</option>` + cursos.map(c => `<option value="${esc(c)}">${esc(c)} (${A.filter(a => a.c === c).length})</option>`).join('');
  if (!cursos.includes(filtro.curso)) filtro.curso = '';
  $('#f-curso').value = filtro.curso;
}

/* ---------- ficha do aluno ---------- */
let fichaId = null;
function abrirFicha(id, empurrar = true) {
  fichaId = id; const a = byId[id];
  $('#ficha-nome').textContent = a.n;
  renderFicha();
  $('#ficha').classList.remove('hide'); $('#ficha').scrollTop = 0;
  if (empurrar) history.pushState({ ficha: id }, '');
}
function fecharFicha() { $('#ficha').classList.add('hide'); fichaId = null; renderAtual(); }
function renderFicha() {
  const a = byId[fichaId]; const noRot = sel.includes(a.id);
  const tel = (a.tel || '').replace(/\D/g, '');
  const telBR = tel.length >= 10 ? (tel.startsWith('55') && tel.length > 11 ? tel : '55' + tel) : '';
  $('#ficha-conteudo').innerHTML = `
    <div class="sub nota">${esc(a.c)}${a.t ? ' · ' + esc(a.t) : ''} · ${esc(a.nv)}</div>
    <div class="caixa">
      <div class="end-grande">${esc(endTxt(a))}</div>
      <div>${esc(a.b ? 'Bairro ' + a.bL + ' · ' : '')}Tupanciretã</div>
      ${a.geo.rua && deac(a.geo.rua) !== deac(a.lg + ' ' + a.r) ? `<div class="nota">No mapa: ${esc(a.geo.rua)}</div>` : ''}
      <div class="nota" style="margin-top:4px">${PREC[a.geo.prec] || ''}</div>
      <a class="btn pri blk" href="${esc(linkMaps('', [destinoMaps(a)]))}" target="_blank" rel="noopener">${ICON.maps} Ir com o Google Maps</a>
      <div class="linha-btn">
        <button class="btn" id="fx-rot">${noRot ? '✓ No roteiro' : '+ Roteiro'}</button>
        <button class="btn" id="fx-mapa">Ver no mapa</button>
      </div>
      ${telBR ? `<div class="linha-btn">
        <a class="btn" href="tel:+${telBR}">${ICON.tel} Ligar</a>
        <a class="btn" href="https://wa.me/${telBR}" target="_blank" rel="noopener">${ICON.zap} WhatsApp</a></div>
        <div class="nota">Celular: ${esc(a.tel)}</div>` : '<div class="nota">Sem celular no cadastro.</div>'}
    </div>`;

  $('#fx-rot').onclick = () => { alternarSel(a.id); renderFicha(); };
  $('#fx-mapa').onclick = () => { history.back(); setTimeout(() => { irPara('mapa'); focarNoMapa(a.id); }, 60); };
}

/* ---------- roteiro ---------- */
function alternarSel(id) {
  const i = sel.indexOf(id);
  if (i >= 0) sel.splice(i, 1); else sel.push(id);
  salvarSel();
}
function ordenarRota(ids) {
  const comLocal = ids.filter(id => byId[id].geo.p), semLocal = ids.filter(id => !byId[id].geo.p);
  const P = comLocal.map(id => byId[id].geo.p);
  const n = P.length; if (n < 2) return comLocal.concat(semLocal);
  const D = (i, j) => dist(P[i], P[j]);
  const rest = new Set(P.map((_, i) => i)); const ord = []; let cur = ENTRADA;
  while (rest.size) { let b = -1, bd = 1e12; for (const i of rest) { const d = dist(cur, P[i]); if (d < bd) { bd = d; b = i; } } ord.push(b); rest.delete(b); cur = P[b]; }
  // 2-opt em caminho aberto a partir da entrada da cidade
  const dE = i => dist(ENTRADA, P[i]);
  let melhorou = true, voltas = 0;
  while (melhorou && voltas++ < 60) {
    melhorou = false;
    for (let i = 0; i < n - 1; i++) for (let k = i + 1; k < n; k++) {
      const a = i === 0 ? null : ord[i - 1], b = ord[i], c = ord[k], d = k + 1 < n ? ord[k + 1] : null;
      const antes = (a === null ? dE(b) : D(a, b)) + (d === null ? 0 : D(c, d));
      const depois = (a === null ? dE(c) : D(a, c)) + (d === null ? 0 : D(b, d));
      if (depois < antes - 0.5) { ord.splice(i, k - i + 1, ...ord.slice(i, k + 1).reverse()); melhorou = true; }
    }
  }
  return ord.map(i => comLocal[i]).concat(semLocal);
}
function renderRoteiro() {
  const el = $('#tela-roteiro');
  const deOnde = LS.get('origem', 'campus');
  if (!sel.length) {
    el.innerHTML = `<div class="vazio"><b style="font-size:17px;color:var(--tinta)">Nenhum aluno no roteiro</b><br><br>
      Na aba <b>Alunos</b>, escolha o curso e toque no quadradinho de quem vai ser visitado.
      Depois toque em <b>Montar roteiro</b>.</div>
      <button class="btn pri blk grande" id="rt-escolher">Escolher alunos</button>`;
    $('#rt-escolher').onclick = () => irPara('alunos');
    return;
  }
  const stops = sel.map(id => byId[id]).filter(Boolean);
  const partes = []; const POR = 9;
  for (let i = 0; i < stops.length; i += POR) partes.push(stops.slice(i, i + POR));
  const links = partes.map((p, i) => {
    const origem = i === 0 ? (deOnde === 'campus' ? CAMPUS.join(',') : '') : destinoMaps(partes[i - 1][partes[i - 1].length - 1]);
    const de = i === 0 ? (deOnde === 'campus' ? 'Saindo do IFFar pela RS-527' : 'Saindo de onde você está') : `Saindo da parada ${i * POR}`;
    return `<a class="gm" href="${esc(linkMaps(origem, p.map(destinoMaps)))}" target="_blank" rel="noopener">${ICON.maps}<div><b>Abrir no Google Maps${partes.length > 1 ? ` (parte ${i + 1} de ${partes.length})` : ''}</b><span>${de} → paradas ${i * POR + 1} a ${i * POR + p.length}</span></div></a>`;
  }).join('');
  const km = (() => { let d = 0, c = deOnde === 'campus' ? CAMPUS : ENTRADA; for (const a of stops) if (a.geo.p) { d += dist(c, a.geo.p); c = a.geo.p; } return (d * 1.3 / 1000).toFixed(0); })();
  el.innerHTML = `<h2>Roteiro: ${stops.length} parada${stops.length > 1 ? 's' : ''}</h2>
    <div class="seg" id="seg-origem"><button data-v="campus" aria-pressed="${deOnde === 'campus'}">Sair do IFFar JC</button><button data-v="aqui" aria-pressed="${deOnde !== 'campus'}">Sair de onde estou</button></div>
    <div class="acoes">
      ${links}
      <button class="btn blk grande" id="rt-imprimir" style="margin:0">${ICON.print} Imprimir / salvar PDF</button>
    </div>
    <div class="nota">Cerca de ${km} km no total.${partes.length > 1 ? ' O Google Maps abre até 9 paradas por vez; ao terminar uma parte, abra a próxima.' : ''}</div>
    <div class="mapa-rot" id="rt-mapa" title="Abrir no mapa">${svgMapa(stops, { tela: true })}</div>
    <div class="nota" style="margin-bottom:10px">Toque no mapa para ampliar.</div>
    <div id="rt-lista">${stops.map((a, i) => `<div class="parada" data-id="${a.id}"><div class="num">${i + 1}</div>
      <div class="txt"><b>${esc(a.n)}</b><span>${esc(endTxt(a, true))}${a.b ? ' · ' + esc(a.bL) : ''}</span></div>
      <button class="mini" data-a="sobe" aria-label="Subir">↑</button><button class="mini" data-a="desce" aria-label="Descer">↓</button><button class="mini" data-a="tira" aria-label="Tirar do roteiro">✕</button></div>`).join('')}</div>
    <div class="linha-btn">
      <button class="btn" id="rt-mais">+ Alunos</button>
      <button class="btn" id="rt-ordenar">Reordenar caminho</button>
    </div>
    <button class="btn blk" id="rt-limpar" style="color:var(--verm)">Limpar roteiro</button>
    <div class="nota">Dica: antes de sair, toque em “Imprimir / salvar PDF” e escolha <b>Salvar como PDF</b>. O PDF tem o mapa das ruas com as paradas numeradas e os endereços, e abre no celular mesmo sem sinal.</div>`;
  $('#rt-mapa').onclick = () => { irPara('mapa'); setTimeout(() => { if (mapa) { const b = L.latLngBounds(stops.filter(a => a.geo.p).map(a => a.geo.p)); if (b.isValid()) mapa.fitBounds(b, { padding: [40, 40] }); } }, 120); };
  $('#seg-origem').onclick = e => { const b = e.target.closest('button'); if (!b) return; LS.set('origem', b.dataset.v); renderRoteiro(); };
  $('#rt-ordenar').onclick = () => { sel = ordenarRota(sel); salvarSel(); renderRoteiro(); toast('Paradas ordenadas a partir da entrada da cidade'); };
  $('#rt-mais').onclick = () => irPara('alunos');
  $('#rt-imprimir').onclick = () => imprimirRoteiro(stops);
  $('#rt-limpar').onclick = () => { if (confirm('Tirar todos os alunos do roteiro?')) { sel = []; salvarSel(); renderRoteiro(); } };
  $('#rt-lista').onclick = e => {
    const b = e.target.closest('button[data-a]'); const row = e.target.closest('.parada'); if (!row) return;
    const id = row.dataset.id; const i = sel.indexOf(id);
    if (!b) { abrirFicha(id); return; }
    if (b.dataset.a === 'tira') sel.splice(i, 1);
    if (b.dataset.a === 'sobe' && i > 0) [sel[i - 1], sel[i]] = [sel[i], sel[i - 1]];
    if (b.dataset.a === 'desce' && i < sel.length - 1) [sel[i + 1], sel[i]] = [sel[i], sel[i + 1]];
    salvarSel(); renderRoteiro();
  };
}

/* ---------- mapa em SVG (impressão e reserva sem internet) ---------- */
let SVGN = 0;
function svgMapa(stops, opt = {}) {
  SVGN++;
  const pts = stops.filter(a => a.geo.p).map(a => a.geo.p);
  if (opt.todos) WAYS.forEach(w => { if (w.hw === 're') pts.push(w.pts[0]); });
  if (!pts.length) pts.push(CENTRO);
  let [x0, y0] = [1e12, 1e12], [x1, y1] = [-1e12, -1e12];
  for (const p of pts) { const [x, y] = xy(p); x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const minSpan = 500; let cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  let w = Math.max(x1 - x0, minSpan) + 240, h = Math.max(y1 - y0, minSpan * 0.7) + 200;
  const W = opt.tela ? 440 : 1000, ratio = Math.min(Math.max(h / w, 0.55), 1.35); const H = Math.round(W * ratio);
  if (h / w < ratio) h = w * ratio; else w = h / ratio;
  x0 = cx - w / 2; y1 = cy + h / 2; const k = W / w;
  const P = p => { const [x, y] = xy(p); return [((x - x0) * k).toFixed(1), ((y1 - y) * k).toFixed(1)]; };
  const dentro = p => { const [x, y] = xy(p); return x > x0 - 50 && x < x0 + w + 50 && y > y1 - h - 50 && y < y1 + 50; };
  const peso = { pr: 5, tr: 5, se: 4, te: 3.5, re: 2.4, un: 2, se2: 2 };
  let ruas = '', nomes = '', defs = '', idn = 0;
  const maior = {};
  for (const wy of WAYS) {
    if (!wy.pts.some(dentro)) continue;
    ruas += `<polyline points="${wy.pts.map(p => P(p).join(',')).join(' ')}" stroke-width="${(peso[wy.hw] || 2) * (k > 1.2 ? 1.2 : 1)}"/>`;
    const nm = wy.name || wy.ref; if (!nm) continue;
    let L = 0; for (let i = 0; i < wy.pts.length - 1; i++) L += dist(wy.pts[i], wy.pts[i + 1]);
    if (!maior[nm] || L > maior[nm].L) maior[nm] = { L, wy };
  }
  const fs = 10.5;
  for (const [nm, { L, wy }] of Object.entries(maior)) {
    const txt = nm.replace(/^Rua /, '').replace(/^Avenida /, 'Av. ').replace(/^Travessa /, 'Tv. ');
    if (L * k < txt.length * fs * 0.55 + 10) continue;
    let ps = wy.pts.map(P);
    if (+ps[ps.length - 1][0] < +ps[0][0]) ps = ps.reverse();
    const id = 'm' + SVGN + 'r' + (idn++);
    defs += `<path id="${id}" d="M${ps.map(p => p.join(',')).join(' L')}"/>`;
    nomes += `<text><textPath href="#${id}" startOffset="50%" text-anchor="middle">${esc(txt)}</textPath></text>`;
  }
  let refs = REFS.filter(r => dentro(r.p)).map(r => { const [x, y] = P(r.p); return `<g><rect x="${x - 5}" y="${y - 5}" width="10" height="10" fill="#333"/><text x="${+x + 8}" y="${+y + 4}" class="ref">${esc(r.n)}</text></g>`; }).join('');
  if (dentro(ENTRADA)) { const [x, y] = P(ENTRADA); refs += `<g><circle cx="${x}" cy="${y}" r="7" fill="#1a73e8"/><text x="${+x + 10}" y="${+y + 4}" class="ref">RS-527 (vem do IFFar)</text></g>`; }
  const marcas = stops.map((a, i) => {
    if (!a.geo.p) return ''; const [x, y] = P(a.geo.p);
    const cor = COR;
    const r = opt.todos ? 6 : (opt.tela ? 11 : 15);
    return `<g><circle cx="${x}" cy="${y}" r="${r}" fill="${cor}" stroke="#fff" stroke-width="2"/>${opt.todos ? '' : `<text x="${x}" y="${+y + r * 0.38}" class="n" style="font-size:${opt.tela ? 12 : 16}px">${i + 1}</text>`}</g>`;
  }).join('');
  const escala = Math.round(100 * k);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" font-family="Arial,Helvetica,sans-serif">
    <defs>${defs}</defs><rect width="${W}" height="${H}" fill="#fff"/>
    <g fill="none" stroke="#b5bcb7" stroke-linecap="round" stroke-linejoin="round">${ruas}</g>
    <g font-size="${fs}" fill="#333" style="paint-order:stroke" stroke="#fff" stroke-width="3">${nomes}</g>
    <style>.ref{font-size:12px;font-weight:bold;fill:#111;paint-order:stroke;stroke:#fff;stroke-width:3px}.n{font-size:12px;font-weight:bold;fill:#fff;text-anchor:middle}</style>
    ${refs}${marcas}
    <g transform="translate(20,${H - 24})"><rect width="${escala}" height="5" fill="#333"/><text y="-5" font-size="11">100 m</text></g>
    <text x="${W - 10}" y="${H - 10}" font-size="10" text-anchor="end" fill="#777">Ruas: © OpenStreetMap · N ↑</text>
  </svg>`;
}
function imprimirRoteiro(stops) {
  const hoje = new Date().toLocaleDateString('pt-BR');
  const linhas = stops.map((a, i) => `<tr><td><b>${i + 1}</b></td><td><b>${esc(a.n)}</b><br>${esc(a.c)}${a.t ? ' · ' + esc(a.t) : ''}${a.tel ? '<br>Cel: ' + esc(a.tel) : ''}</td>
    <td>${esc(endTxt(a))}${a.b ? '<br>Bairro ' + esc(a.bL) : ''}${a.geo.rua && deac(a.geo.rua) !== deac(a.lg + ' ' + a.r) ? '<br><i>No mapa: ' + esc(a.geo.rua) + '</i>' : ''}${a.geo.prec === 'bairro' || a.geo.prec === 'semlocal' ? '<br><i>(local aproximado)</i>' : ''}</td>
    <td style="width:55mm">&nbsp;</td></tr>`).join('');
  $('#impressao').innerHTML = `<h1>Roteiro de visitas · Tupanciretã</h1>
    <div class="pq">IFFar Campus Júlio de Castilhos · ${hoje} · ${stops.length} paradas · Saída do campus pela RS-527, entrada na cidade pela Av. Padre Roque Gonzales</div>
    ${svgMapa(stops)}
    <div class="pq">Os pontos foram estimados pelo endereço do cadastro (número da casa = metros a partir do centro). Confirme a casa pelo número na rua.</div>
    <table class="quebra-auto"><thead><tr><th>#</th><th>Aluno</th><th>Endereço</th><th>Anotações</th></tr></thead><tbody>${linhas}</tbody></table>`;
  setTimeout(() => window.print(), 100);
}

/* ---------- mapa interativo ---------- */
let mapa = null, camadaAlunos = null, camadaRotulos = null, camadaTiles = null, eu = null, rotulos = [];
function iniciarMapa() {
  if (mapa) { mapa.invalidateSize(); desenharAlunos(); return; }
  if (!window.L) { // sem Leaflet (sem internet na 1ª vez): mostra o mapa em SVG
    $('#mapa').classList.add('hide'); $('#mapa-svg').classList.remove('hide');
    $('#mapa-svg').innerHTML = '<div class="nota">Mapa simplificado (sem internet).</div>' + svgMapa(filtrados(), { todos: true, cor: true, tela: true });
    return;
  }
  const ren = L.canvas({ padding: 0.5 });
  mapa = L.map('mapa', { zoomControl: false, preferCanvas: true, attributionControl: true }).setView([-29.0790, -53.8370], 15);
  mapa.attributionControl.setPrefix('').addAttribution('© OpenStreetMap');
  L.control.zoom({ position: 'bottomright' }).addTo(mapa);
  const cor = { pr: '#e8b04a', tr: '#e8b04a', se: '#f0c86a', te: '#ffffff', re: '#ffffff', un: '#ffffff', se_: '#fff' };
  const larg = { pr: 6, tr: 6, se: 5, te: 4.5, re: 3.6, un: 3, pa: 1.5 };
  // ruas embutidas: funcionam sem internet
  const base = L.layerGroup().addTo(mapa);
  for (const w of WAYS) L.polyline(w.pts, { renderer: ren, color: '#c9cfc9', weight: (larg[w.hw] || 3) + 2, interactive: false }).addTo(base);
  for (const w of WAYS) L.polyline(w.pts, { renderer: ren, color: cor[w.hw] || '#fff', weight: larg[w.hw] || 3, interactive: false }).addTo(base);
  // nomes das ruas (aparecem com zoom)
  camadaRotulos = L.layerGroup();
  const vistos = {};
  for (const w of WAYS) {
    const nm = w.name || w.ref; if (!nm || w.pts.length < 2) continue;
    for (let i = 0; i < w.pts.length - 1; i++) {
      const a = w.pts[i], b = w.pts[i + 1], L0 = dist(a, b); if (L0 < 90) continue;
      const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const chave = nm + Math.round(m[0] * 400) + Math.round(m[1] * 400); if (vistos[chave]) continue; vistos[chave] = 1;
      const [ax, ay] = xy(a), [bx, by] = xy(b); let ang = -Math.atan2(by - ay, bx - ax) * 180 / Math.PI;
      if (ang > 90) ang -= 180; if (ang < -90) ang += 180;
      const txt = nm.replace(/^Rua /, '').replace(/^Avenida /, 'Av. ').replace(/^Travessa /, 'Tv. ');
      rotulos.push(L.marker(m, { interactive: false, keyboard: false, icon: L.divIcon({ className: '', iconSize: [0, 0], html: `<div class="rotulo-rua" style="transform:translate(-50%,-50%) rotate(${ang.toFixed(0)}deg)">${esc(txt)}</div>` }) }));
    }
  }
  rotulos.forEach(r => r.addTo(camadaRotulos));
  const ajustaRotulos = () => { if (mapa.getZoom() >= 16) camadaRotulos.addTo(mapa); else camadaRotulos.remove(); };
  mapa.on('zoomend', ajustaRotulos); ajustaRotulos();
  // pontos de referência
  REFS.forEach(r => L.circleMarker(r.p, { radius: 5, color: '#333', fillColor: '#333', fillOpacity: 1, weight: 1 }).bindTooltip(r.n).addTo(mapa));
  L.circleMarker(ENTRADA, { radius: 7, color: '#fff', fillColor: '#1a73e8', fillOpacity: 1, weight: 2 }).bindTooltip('RS-527: entrada vindo do IFFar').addTo(mapa);
  camadaAlunos = L.layerGroup().addTo(mapa);

  const ctl = document.createElement('div'); ctl.className = 'mapa-ctl';
  ctl.innerHTML = `<button id="mp-eu" aria-label="Onde estou">${ICON.gps.replace('<svg', '<svg width="22" height="22"')}</button><button id="mp-det">Mapa detalhado</button><button id="mp-todos">Ver todos</button>`;
  $('#tela-mapa').appendChild(ctl);
  const info = document.createElement('div'); info.className = 'mapa-info'; info.id = 'mapa-info'; $('#tela-mapa').appendChild(info);
  $('#mp-det').onclick = () => {
    if (camadaTiles) { camadaTiles.remove(); camadaTiles = null; $('#mp-det').textContent = 'Mapa detalhado'; LS.set('tiles', 0); return; }
    camadaTiles = L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, opacity: 0.9 }).addTo(mapa); camadaTiles.bringToBack();
    $('#mp-det').textContent = 'Só ruas (leve)'; LS.set('tiles', 1);
  };
  if (LS.get('tiles', 0)) $('#mp-det').click();
  $('#mp-todos').onclick = () => { const b = L.latLngBounds(filtrados().filter(a => a.geo.p).map(a => a.geo.p)); if (b.isValid()) mapa.fitBounds(b, { padding: [30, 30] }); };
  $('#mp-eu').onclick = () => {
    if (!navigator.geolocation) return toast('GPS indisponível neste aparelho.');
    toast('Buscando sua posição…');
    navigator.geolocation.getCurrentPosition(p => {
      const ll = [p.coords.latitude, p.coords.longitude];
      if (!eu) eu = L.circleMarker(ll, { radius: 9, color: '#fff', weight: 3, fillColor: '#1a73e8', fillOpacity: 1 }).addTo(mapa); else eu.setLatLng(ll);
      mapa.setView(ll, Math.max(mapa.getZoom(), 16));
    }, () => toast('Não foi possível ler o GPS.'), { enableHighAccuracy: true, timeout: 20000 });
  };
  desenharAlunos();
}
function desenharAlunos() {
  if (!mapa) return;
  camadaAlunos.clearLayers();
  const L0 = filtrados(); let semLocal = 0;
  const noFiltro = new Set(L0.map(a => a.id));
  sel.forEach(id => { if (!noFiltro.has(id) && byId[id]) L0.push(byId[id]); });   // paradas do roteiro sempre aparecem
  for (const a of L0) {
    if (!a.geo.p) { semLocal++; continue; }
    const pos = sel.indexOf(a.id);
    const m = pos >= 0
      ? L.marker(a.geo.p, { zIndexOffset: 1000, icon: L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13], html: `<div class="pino" style="width:26px;height:26px;background:${COR}">${pos + 1}</div>` }) })
      : L.circleMarker(a.geo.p, { radius: 7, color: '#fff', weight: 2, fillColor: sel.length ? COR_FORA : COR, fillOpacity: 1, dashArray: a.geo.prec === 'bairro' ? '3' : null });
    m.bindPopup(() => {
      const d = document.createElement('div');
      d.innerHTML = `<b>${esc(a.n)}</b><br>${esc(endTxt(a))}<br><span class="nota">${esc(a.c)}${a.bL ? ' · ' + esc(a.bL) : ''}</span><br>
        <button class="btn pri" data-a="ficha">Abrir ficha</button><button class="btn" data-a="rot">${sel.includes(a.id) ? 'Tirar do roteiro' : '+ Roteiro'}</button>
        <a class="btn" href="${esc(linkMaps('', [destinoMaps(a)]))}" target="_blank" rel="noopener">Ir</a>`;
      d.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'ficha') abrirFicha(a.id); else { alternarSel(a.id); mapa.closePopup(); desenharAlunos(); } };
      return d;
    });
    m.addTo(camadaAlunos);
  }
  $('#mapa-info').innerHTML = `${filtro.curso ? esc(filtro.curso) + ': ' : ''}${L0.length} alunos${semLocal ? ` (${semLocal} sem local)` : ''}${sel.length ? `<br><span class="leg"><i style="background:${COR}"></i>no roteiro (${sel.length})</span><span class="leg"><i style="background:${COR_FORA}"></i>outros</span>` : ''}`;
}
function focarNoMapa(id) {
  const a = byId[id]; if (!a.geo.p) { toast('Este aluno não tem local no mapa.'); return; }
  if (!mapa) return;
  setTimeout(() => { mapa.invalidateSize(); mapa.setView(a.geo.p, 17); camadaAlunos.eachLayer(l => { const p = l.getLatLng(); if (Math.abs(p.lat - a.geo.p[0]) < 1e-7 && Math.abs(p.lng - a.geo.p[1]) < 1e-7) l.openPopup(); }); }, 80);
}

/* ---------- navegação ---------- */
let telaAtual = 'alunos';
function irPara(t) {
  telaAtual = t;
  document.querySelectorAll('section.tela').forEach(s => s.classList.toggle('hide', s.id !== 'tela-' + t));
  document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-current', b.dataset.tela === t ? 'page' : 'false'));
  renderAtual(); atualizarBarra(); window.scrollTo(0, 0);
}
function renderAtual() {
  if (telaAtual === 'alunos') renderLista();
  if (telaAtual === 'mapa') iniciarMapa();
  if (telaAtual === 'roteiro') renderRoteiro();
}
function atualizarBolhas() {
  const b = $('#bolha-rot'); b.textContent = sel.length; b.classList.toggle('hide', !sel.length);
  atualizarBarra();
}

/* ---------- início ---------- */
let ruasProntas = false;
function entrar(d) {
  DB = d;
  A = DB.alunos; byId = Object.fromEntries(A.map(a => [a.id, a]));
  sel = sel.filter(id => byId[id]);
  if (!ruasProntas) { carregarRuas(); ruasProntas = true; }
  localizarTodos(); montarFiltros();
  $('#entrada').classList.add('hide');
  $('#sub-topo').textContent = `${A.length} alunos · IFFar Júlio de Castilhos`;
  atualizarBolhas(); renderAtual();
}
function ligarEventos() {
  $('#nav').onclick = e => { const b = e.target.closest('button'); if (b) irPara(b.dataset.tela); };
  let tq; $('#busca').oninput = e => { clearTimeout(tq); tq = setTimeout(() => { filtro.q = e.target.value; renderLista(); }, 150); };
  $('#f-bairro').onchange = e => { filtro.bairro = e.target.value; renderLista(); };
  $('#f-curso').onchange = e => { filtro.curso = e.target.value; LS.set('curso', filtro.curso); renderLista(); };
  $('#f-ordem').onchange = e => { filtro.ordem = e.target.value; renderLista(); };
  $('#bt-add-todos').onclick = () => {
    const L = filtrados(); const ns = new Set(sel);
    if (L.length && L.every(a => ns.has(a.id))) { const tirar = new Set(L.map(a => a.id)); sel = sel.filter(id => !tirar.has(id)); }
    else {
      const novos = L.filter(a => !ns.has(a.id));
      if (novos.length > 30 && !confirm(`Marcar ${novos.length} alunos?`)) return;
      sel = sel.concat(novos.map(a => a.id));
    }
    salvarSel(); renderLista();
  };
  $('#lista').onclick = e => {
    const card = e.target.closest('.card'); if (!card) return; const id = card.dataset.id;
    if (e.target.closest('.chk')) { alternarSel(id); renderLista(); } else abrirFicha(id);
  };
  $('#bs-montar').onclick = montarRoteiro;
  $('#bs-limpar').onclick = () => { sel = []; salvarSel(); renderLista(); };
  $('#bt-fecha-ficha').onclick = () => history.back();
  window.addEventListener('popstate', () => { if (fichaId) fecharFicha(); });
  $('#form-entrada').onsubmit = e => e.preventDefault();
  $('#in-arquivo').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!dadosValidos(d)) throw new Error('formato');
      guardarDados(d); entrar(LS.get('dados', d));
    } catch (err) { $('#erro-entrada').textContent = 'Este arquivo não é a lista de alunos do app.'; }
  };
}
ligarEventos();
(async () => {
  const d = await obterDados();
  if (d) entrar(d); else $('#entrada').classList.remove('hide');
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();
// abrir um link novo de dados com o app já aberto
window.addEventListener('hashchange', async () => { if (location.hash.startsWith('#d=')) { const d = await obterDados(); if (d) entrar(d); } });

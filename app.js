'use strict';
/* Visitas Tupanciretã — IFFar Campus Júlio de Castilhos
   Tudo roda no celular: dados cifrados (data.js), ruas do OpenStreetMap (ruas.js),
   marcações guardadas no próprio aparelho e enviadas por e-mail ao coordenador. */

let EMAIL = '';   // vem junto com os dados dos alunos (não fica no código público)
const CAMPUS = [-29.18167, -53.71464];
const CENTRO = [-29.08129, -53.83648];           // Igreja Matriz (marco do centro)
const REFS = [
  { n: 'Igreja Matriz', p: [-29.08129, -53.83648] },
  { n: 'Prefeitura', p: [-29.08492, -53.83656] },
];
const ITENS = [
  ['agua', 'Água potável'], ['cesta', 'Cesta básica / alimentos'], ['colchao', 'Colchão'],
  ['cobertor', 'Cobertor / roupa de cama'], ['roupa', 'Roupas / calçados'], ['lona', 'Lona'],
  ['telha', 'Telhas'], ['construcao', 'Material de construção'], ['higiene', 'Kit higiene'],
  ['limpeza', 'Kit limpeza'], ['escolar', 'Material escolar'], ['remedio', 'Remédios'], ['fralda', 'Fraldas'],
];
const NOME_ITEM = Object.fromEntries(ITENS);
const SITUACOES = ['Sem danos', 'Danos leves', 'Destelhada', 'Inabitável'];
const STATUS = {
  visitado: { t: 'Visitado', c: '#1f8a3b' },
  ausente: { t: 'Ninguém em casa', c: '#c77700' },
  voltar: { t: 'Voltar depois', c: '#6a45c2' },
};
const COR_PENDENTE = '#c62828';
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
let edits = LS.get('edits', {});
let sel = LS.get('sel', []);
let equipe = LS.get('equipe', '');
let filtro = { q: '', st: 'todos', bairro: '', curso: '', nivel: '', ordem: 'bairro' };
let ENTRADA = null;

function rec(id) {
  const b = DB.visitas && DB.visitas[id], e = edits[id];
  if (!e) return b || null;
  if (!b) return e;
  return (e.qd || '') >= (b.qd || '') ? e : b;
}
function stDe(id) { const r = rec(id); return r && r.st ? r.st : ''; }
function salvarEdit(id, patch) {
  const base = rec(id) || {};
  edits[id] = Object.assign({}, base, patch, { qd: agora(), eq: equipe });
  LS.set('edits', edits);
  atualizarBolhas();
}
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
    const r = rec(a.id); const fix = (r && r.loc) || (DB.locais && DB.locais[a.id]);
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
  const st = stDe(a.id);
  if (filtro.st === 'pendente' && st) return false;
  if (filtro.st === 'feito' && st !== 'visitado') return false;
  if (filtro.st === 'ausente' && !(st === 'ausente' || st === 'voltar')) return false;
  if (filtro.bairro && a.bK !== filtro.bairro) return false;
  if (filtro.curso && a.c !== filtro.curso) return false;
  if (filtro.nivel && a.nv !== filtro.nivel) return false;
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
  else if (filtro.ordem === 'campus') L.sort((x, y) => (x.geo.p ? dist(x.geo.p, ENTRADA) : 1e9) - (y.geo.p ? dist(y.geo.p, ENTRADA) : 1e9));
  else L.sort((x, y) => (x.bL || 'zzz').localeCompare(y.bL || 'zzz', 'pt') || (x.geo.rua || x.r).localeCompare(y.geo.rua || y.r, 'pt') || x.numN - y.numN);
  return L;
}

/* ---------- tela: alunos ---------- */
function tagStatus(id) {
  const r = rec(id); const st = r && r.st;
  if (!st) return `<span class="tag st" style="background:${COR_PENDENTE}">A visitar</span>`;
  return `<span class="tag st" style="background:${STATUS[st].c}">${STATUS[st].t}</span><span class="tag">${esc(r.eq || '')}${r.qd ? ' · ' + dataBR(r.qd) : ''}</span>`;
}
function necResumo(r) {
  if (!r || !r.nec) return '';
  return Object.entries(r.nec).filter(([, q]) => q > 0).map(([k, q]) => `${NOME_ITEM[k] || k}${q > 1 ? ' ×' + q : ''}`).join(', ');
}
function renderLista() {
  const L = filtrados();
  $('#contagem').textContent = `${L.length} de ${A.length} alunos`;
  const ns = new Set(sel);
  if (!L.length) { $('#lista').innerHTML = '<div class="vazio">Nenhum aluno com esses filtros.</div>'; return; }
  $('#lista').innerHTML = L.map(a => {
    const r = rec(a.id); const pos = sel.indexOf(a.id);
    const nec = necResumo(r);
    return `<div class="card" data-id="${a.id}">
      <button class="chk" aria-pressed="${ns.has(a.id)}" aria-label="Incluir no roteiro"><span>${pos >= 0 ? pos + 1 : ''}</span></button>
      <button class="corpo">
        <div class="nome">${esc(a.n)}</div>
        <div class="sub">${esc(a.c)}${a.t ? ' · ' + esc(a.t) : ''}</div>
        <div class="end">${esc(endTxt(a))}</div>
        <div class="tags">${a.b ? `<span class="tag">${esc(a.b)}</span>` : ''}${tagStatus(a.id)}
          ${a.geo.prec === 'bairro' || a.geo.prec === 'semlocal' ? '<span class="tag aviso">local aproximado</span>' : ''}
          ${nec ? `<span class="tag aviso">Precisa: ${esc(nec)}</span>` : ''}</div>
      </button></div>`;
  }).join('');
}
function montarFiltros() {
  const bairros = {};
  for (const a of A) { a.bK = deac(a.b).replace(/^bairro\s+/, '').replace(/\s+/g, ' ').trim(); a.bL = a.b.replace(/^Bairro\s+/i, ''); if (a.bK) bairros[a.bK] = bairros[a.bK] || a.bL; }
  const bs = Object.entries(bairros).sort((x, y) => x[1].localeCompare(y[1], 'pt'));
  $('#f-bairro').innerHTML = '<option value="">Todos os bairros</option>' + bs.map(([k, l]) => `<option value="${esc(k)}">${esc(l)} (${A.filter(a => a.bK === k).length})</option>`).join('');
  const cursos = [...new Set(A.map(a => a.c))].sort((x, y) => x.localeCompare(y, 'pt'));
  $('#f-curso').innerHTML = '<option value="">Todos os cursos</option>' + cursos.map(c => `<option>${esc(c)}</option>`).join('');
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
  const a = byId[fichaId]; const r = rec(a.id) || {}; const noRot = sel.includes(a.id);
  const tel = (a.tel || '').replace(/\D/g, '');
  const telBR = tel.length >= 10 ? (tel.startsWith('55') && tel.length > 11 ? tel : '55' + tel) : '';
  const nec = r.nec || {};
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
    </div>

    <div class="caixa">
      <h3>Visita</h3>
      <div class="opcoes st" id="fx-st">
        ${Object.entries(STATUS).map(([k, s]) => `<button data-v="${k}" aria-pressed="${r.st === k}" style="${r.st === k ? 'background:' + s.c : ''}">${s.t}</button>`).join('')}
      </div>
      ${r.st ? `<div class="nota" style="margin-top:8px">Marcado por ${esc(r.eq || '?')} em ${dataBR(r.qd)} · <button class="lnk" id="fx-limpa">desfazer</button></div>` : '<div class="nota" style="margin-top:8px">Ainda não visitado.</div>'}
    </div>

    <div class="caixa">
      <h3>Situação da casa</h3>
      <div class="opcoes" id="fx-sit">${SITUACOES.map(s => `<button aria-pressed="${r.sit === s}">${s}</button>`).join('')}</div>
    </div>

    <div class="caixa">
      <h3>Do que precisa</h3>
      <div id="fx-nec">${ITENS.map(([k, n]) => `<div class="nec ${nec[k] > 0 ? 'on' : ''}" data-k="${k}"><span>${n}</span>
        <div class="qtd"><button data-d="-1" aria-label="Menos">−</button><output>${nec[k] || 0}</output><button data-d="1" aria-label="Mais">+</button></div></div>`).join('')}</div>
      <label class="nota" for="fx-obs" style="display:block;margin:10px 0 4px">Outras necessidades e observações</label>
      <textarea id="fx-obs" placeholder="Ex.: família de 5 pessoas, 2 crianças; precisa de fogão">${esc(r.obs || '')}</textarea>
    </div>

    <div class="caixa">
      <h3>Local exato</h3>
      <div class="nota">Na frente da casa, toque abaixo para gravar a posição do GPS. Ela vai no relatório e corrige o mapa para todos.</div>
      <button class="btn blk" id="fx-gps">${ICON.gps} Estou na frente da casa</button>
      ${r.loc ? `<div class="nota">GPS gravado: ${r.loc.map(v => v.toFixed(5)).join(', ')}</div>` : ''}
    </div>`;

  $('#fx-rot').onclick = () => { alternarSel(a.id); renderFicha(); };
  $('#fx-mapa').onclick = () => { history.back(); setTimeout(() => { irPara('mapa'); focarNoMapa(a.id); }, 60); };
  $('#fx-st').onclick = e => { const b = e.target.closest('button'); if (!b) return; salvarEdit(a.id, { st: b.dataset.v }); renderFicha(); toast(STATUS[b.dataset.v].t + ' ✓'); };
  const lp = $('#fx-limpa'); if (lp) lp.onclick = () => { salvarEdit(a.id, { st: '' }); renderFicha(); };
  $('#fx-sit').onclick = e => { const b = e.target.closest('button'); if (!b) return; const v = b.textContent; salvarEdit(a.id, { sit: (rec(a.id) || {}).sit === v ? '' : v }); renderFicha(); };
  $('#fx-nec').onclick = e => {
    const b = e.target.closest('button[data-d]'); if (!b) return;
    const row = b.closest('.nec'); const k = row.dataset.k;
    const n = Object.assign({}, (rec(a.id) || {}).nec || {}); n[k] = Math.max(0, (n[k] || 0) + (+b.dataset.d));
    if (!n[k]) delete n[k];
    salvarEdit(a.id, { nec: n });
    row.querySelector('output').textContent = n[k] || 0; row.classList.toggle('on', n[k] > 0);
  };
  let tmr; $('#fx-obs').oninput = e => { clearTimeout(tmr); const v = e.target.value; tmr = setTimeout(() => salvarEdit(a.id, { obs: v }), 500); };
  $('#fx-gps').onclick = () => {
    if (!navigator.geolocation) return toast('Este celular não deu acesso ao GPS.');
    toast('Buscando posição…');
    navigator.geolocation.getCurrentPosition(p => {
      const loc = [+p.coords.latitude.toFixed(6), +p.coords.longitude.toFixed(6)];
      if (dist(loc, CENTRO) > 40000) { toast('O GPS indica um lugar longe de Tupanciretã. Não foi gravado.'); return; }
      salvarEdit(a.id, { loc, locPrec: Math.round(p.coords.accuracy) });
      a.geo = Object.assign({}, a.geo, { p: loc, prec: 'gps' });
      renderFicha(); toast('Local gravado (precisão ~' + Math.round(p.coords.accuracy) + ' m)');
    }, () => toast('Não foi possível ler o GPS. Verifique se a localização está ligada.'), { enableHighAccuracy: true, timeout: 20000 });
  };
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
/* digitar "pedro, joão e maria" e montar o roteiro */
let duvidas = [], naoAchados = [];
function acharPorNome(termo, curso) {
  const t = deac(termo).replace(/[^a-z0-9 ]+/g, ' ').trim().split(/\s+/).filter(Boolean);
  if (!t.length) return [];
  const pontos = a => { const pal = deac(a.n).split(/\s+/); return (pal[0] === t[0] ? 4 : pal[0].startsWith(t[0]) ? 2 : 0) + t.filter(x => pal.includes(x)).length; };
  return A.filter(a => {
    if (curso && a.c !== curso) return false;
    const pal = deac(a.n).split(/\s+/);
    return t.every(x => pal.some(p => p.startsWith(x)));
  }).sort((x, y) => pontos(y) - pontos(x) || x.n.localeCompare(y.n, 'pt'));
}
function adicionarNomes(texto) {
  const curso = LS.get('rotCurso', '');
  const termos = texto.split(/[,;\n]+|\s+e\s+/i).map(s => s.trim()).filter(Boolean);
  duvidas = []; naoAchados = []; let novos = 0;
  for (const termo of termos) {
    const r = acharPorNome(termo, curso);
    if (!r.length) naoAchados.push(termo);
    else if (r.length === 1) { if (!sel.includes(r[0].id)) { sel.push(r[0].id); novos++; } }
    else duvidas.push({ termo, ids: r.map(a => a.id) });
  }
  if (novos) { sel = ordenarRota(sel); salvarSel(); }
  renderRoteiro();
  if (novos) toast(`${novos} aluno(s) no roteiro`);
}
function blocoNomes() {
  const curso = LS.get('rotCurso', '');
  const cursos = [...new Set(A.map(a => a.c))].sort((x, y) => x.localeCompare(y, 'pt'));
  const nCurso = curso ? A.filter(a => a.c === curso).length : A.length;
  return `<div class="caixa passo"><h3><span class="np">1</span> Quem vai</h3>
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px"><b style="font-size:17px">${esc(equipe)}</b><button class="lnk" id="rt-equipe">trocar</button></div>
    </div>
    <div class="caixa passo">
    <h3><span class="np">2</span> Quem vamos visitar</h3>
    <select class="campo" id="rt-curso" aria-label="Curso" style="margin-bottom:8px">
      <option value="">Todos os cursos (${A.length} alunos)</option>
      ${cursos.map(c => `<option ${c === curso ? 'selected' : ''}>${esc(c)}</option>`).join('')}
    </select>
    <div class="nomes"><textarea id="rt-nomes" placeholder="Digite os nomes separados por vírgula. Ex.: Pedro, João Lucas, Maria" autocomplete="off"></textarea></div>
    <button class="btn pri blk" id="rt-add">Montar roteiro</button>
    ${curso ? `<button class="lnk" id="rt-ver-curso">Ver a lista dos ${nCurso} alunos de ${esc(curso)} em Tupanciretã ›</button>` : ''}
    ${naoAchados.length ? `<div class="duvida"><b>Não encontrei${curso ? ' neste curso' : ''}:</b>${naoAchados.map(esc).join(', ')}<div class="nota">Confira a grafia ou escolha “Todos os cursos”.</div></div>` : ''}
    ${duvidas.map((d, i) => `<div class="duvida" data-i="${i}"><b>Qual “${esc(d.termo)}”? Toque no aluno certo: <button class="lnk" data-pula="${i}">pular</button></b><div class="opcoes">
      ${d.ids.slice(0, 12).map(id => { const a = byId[id]; const ja = sel.includes(id); return `<button data-id="${id}" aria-pressed="${ja}">${ja ? '✓ ' : ''}${esc(a.n)}<small>${esc(a.c)}${a.t ? ' · ' + esc(a.t) : ''} · ${esc(a.bL || endTxt(a, true))}</small></button>`; }).join('')}
      ${d.ids.length > 12 ? `<div class="nota">… e mais ${d.ids.length - 12}. Digite também o sobrenome.</div>` : ''}
    </div></div>`).join('')}
  </div>`;
}
function ligarBlocoNomes() {
  $('#rt-equipe').onclick = trocarEquipe;
  $('#rt-curso').onchange = e => { LS.set('rotCurso', e.target.value); duvidas = []; naoAchados = []; renderRoteiro(); };
  $('#rt-add').onclick = () => { const v = $('#rt-nomes').value; if (!v.trim()) { $('#rt-nomes').focus(); return; } adicionarNomes(v); };
  const vc = $('#rt-ver-curso'); if (vc) vc.onclick = () => { filtro.curso = LS.get('rotCurso', ''); $('#f-curso').value = filtro.curso; irPara('alunos'); };
  document.querySelectorAll('.duvida [data-pula]').forEach(b => b.onclick = () => { duvidas.splice(+b.dataset.pula, 1); renderRoteiro(); });
  document.querySelectorAll('.duvida .opcoes button[data-id]').forEach(b => b.onclick = () => {
    const id = b.dataset.id; const i = +b.closest('.duvida').dataset.i;
    if (!sel.includes(id)) { sel.push(id); sel = ordenarRota(sel); }
    duvidas.splice(i, 1);   // escolhido: a pergunta some
    salvarSel(); renderRoteiro(); toast(byId[id].n.split(' ')[0] + ' no roteiro');
  });
}
function renderRoteiro() {
  const el = $('#tela-roteiro');
  const deOnde = LS.get('origem', 'campus');
  if (!sel.length) {
    el.innerHTML = blocoNomes() + `<div class="nota" style="text-align:center;margin-top:16px">Ou escolha na aba <b>Alunos</b>, tocando no quadradinho ao lado de cada nome.</div>`;
    ligarBlocoNomes();
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
  el.innerHTML = blocoNomes() + `<div class="caixa passo"><h3><span class="np">3</span> Onde: ${stops.length} parada${stops.length > 1 ? 's' : ''}</h3>
    <div class="seg" id="seg-origem"><button data-v="campus" aria-pressed="${deOnde === 'campus'}">Sair do IFFar JC</button><button data-v="aqui" aria-pressed="${deOnde !== 'campus'}">Sair de onde estou</button></div>
    ${links}
    <div class="mapa-rot" id="rt-mapa" title="Abrir no mapa">${svgMapa(stops, { tela: true, cor: true })}</div>
    <div class="nota">Toque no mapa para ampliar.</div></div>
    <div class="nota">Cerca de ${km} km no total. O Google Maps abre até 9 paradas por vez; ao terminar uma parte, abra a próxima.</div>
    <div class="linha-btn">
      <button class="btn" id="rt-ordenar">Ordenar melhor caminho</button>
      <button class="btn" id="rt-imprimir">${ICON.print} Imprimir / PDF</button>
    </div>
    <div id="rt-lista">${stops.map((a, i) => {
      const st = stDe(a.id);
      return `<div class="parada" data-id="${a.id}"><div class="num" style="${st ? 'background:' + STATUS[st].c : ''}">${i + 1}</div>
      <div class="txt"><b>${esc(a.n)}</b><span>${esc(endTxt(a, true))}${a.b ? ' · ' + esc(a.bL) : ''}${st ? ' · ' + STATUS[st].t : ''}</span></div>
      <button class="mini" data-a="sobe" aria-label="Subir">↑</button><button class="mini" data-a="desce" aria-label="Descer">↓</button><button class="mini" data-a="tira" aria-label="Tirar do roteiro">✕</button></div>`;
    }).join('')}</div>
    <button class="btn blk" id="rt-limpar" style="color:var(--verm)">Limpar roteiro</button>
    <div class="nota">Dica: antes de sair, toque em “Imprimir / PDF” e escolha <b>Salvar como PDF</b> (ou uma impressora). O PDF tem o mapa das ruas com os números das paradas e espaço para anotar as necessidades. Ele abre no celular mesmo sem sinal.</div>`;
  ligarBlocoNomes();
  $('#rt-mapa').onclick = () => { irPara('mapa'); setTimeout(() => { if (mapa) { const b = L.latLngBounds(stops.filter(a => a.geo.p).map(a => a.geo.p)); if (b.isValid()) mapa.fitBounds(b, { padding: [40, 40] }); } }, 120); };
  $('#seg-origem').onclick = e => { const b = e.target.closest('button'); if (!b) return; LS.set('origem', b.dataset.v); renderRoteiro(); };
  $('#rt-ordenar').onclick = () => { sel = ordenarRota(sel); salvarSel(); renderRoteiro(); toast('Paradas ordenadas a partir da entrada da cidade'); };
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
    if (!a.geo.p) return ''; const [x, y] = P(a.geo.p); const st = stDe(a.id);
    const cor = opt.cor ? (st ? STATUS[st].c : COR_PENDENTE) : '#c62828';
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
    <td style="width:22mm">☐ Visitado<br>☐ Ninguém</td><td style="width:62mm">&nbsp;</td></tr>`).join('');
  $('#impressao').innerHTML = `<h1>Roteiro de visitas · Tupanciretã</h1>
    <div class="pq">IFFar Campus Júlio de Castilhos · Equipe: ${esc(equipe)} · ${hoje} · ${stops.length} paradas · Saída do campus pela RS-527, entrada na cidade pela Av. Padre Roque Gonzales</div>
    ${svgMapa(stops)}
    <div class="pq">Os pontos foram estimados pelo endereço do cadastro (número da casa = metros a partir do centro). Confirme a casa pelo número na rua.</div>
    <table class="quebra-auto"><thead><tr><th>#</th><th>Aluno</th><th>Endereço</th><th>Visita</th><th>Do que precisa (água, cesta, colchão, roupas, lona, telhas, higiene, limpeza…)</th></tr></thead><tbody>${linhas}</tbody></table>`;
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
  for (const a of L0) {
    if (!a.geo.p) { semLocal++; continue; }
    const st = stDe(a.id); const cor = st ? STATUS[st].c : COR_PENDENTE; const pos = sel.indexOf(a.id);
    const m = pos >= 0
      ? L.marker(a.geo.p, { icon: L.divIcon({ className: '', iconSize: [26, 26], iconAnchor: [13, 13], html: `<div class="pino" style="width:26px;height:26px;background:${cor}">${pos + 1}</div>` }) })
      : L.circleMarker(a.geo.p, { radius: 8, color: '#fff', weight: 2, fillColor: cor, fillOpacity: 1, dashArray: a.geo.prec === 'bairro' ? '3' : null });
    m.bindPopup(() => {
      const d = document.createElement('div');
      d.innerHTML = `<b>${esc(a.n)}</b><br>${esc(endTxt(a))}<br><span class="nota">${esc(a.bL || '')} · ${st ? STATUS[st].t : 'A visitar'}</span><br>
        <button class="btn pri" data-a="ficha">Abrir ficha</button><button class="btn" data-a="rot">${sel.includes(a.id) ? 'Tirar do roteiro' : '+ Roteiro'}</button>
        <a class="btn" href="${esc(linkMaps('', [destinoMaps(a)]))}" target="_blank" rel="noopener">Ir</a>`;
      d.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'ficha') abrirFicha(a.id); else { alternarSel(a.id); mapa.closePopup(); desenharAlunos(); } };
      return d;
    });
    m.addTo(camadaAlunos);
  }
  $('#mapa-info').innerHTML = `<span class="leg"><i style="background:${COR_PENDENTE}"></i>A visitar</span><span class="leg"><i style="background:${STATUS.visitado.c}"></i>Visitado</span><span class="leg"><i style="background:${STATUS.ausente.c}"></i>Sem contato</span><br>${L0.length} alunos no filtro${semLocal ? ` · ${semLocal} sem local` : ''}`;
}
function focarNoMapa(id) {
  const a = byId[id]; if (!a.geo.p) { toast('Este aluno não tem local no mapa.'); return; }
  if (!mapa) return;
  setTimeout(() => { mapa.invalidateSize(); mapa.setView(a.geo.p, 17); camadaAlunos.eachLayer(l => { const p = l.getLatLng(); if (Math.abs(p.lat - a.geo.p[0]) < 1e-7 && Math.abs(p.lng - a.geo.p[1]) < 1e-7) l.openPopup(); }); }, 80);
}

/* ---------- compras e relatório ---------- */
function relatorio() {
  const itens = Object.entries(edits).map(([id, r]) => { const a = byId[id]; return Object.assign({ id, nome: a ? a.n : '', end: a ? endTxt(a) + (a.b ? ' - ' + a.bL : '') : '' }, r); });
  return { app: 'visitas-tupancireta', v: 1, equipe, enviado: agora(), dadosDe: DB.gerado, itens };
}
function textoRelatorio(rel) {
  const L = rel.itens.map(r => {
    const partes = [`${r.nome} (${r.end})`];
    partes.push(r.st ? STATUS[r.st].t + ' em ' + dataBR(r.qd) : 'Sem marcação de visita');
    if (r.sit) partes.push('Casa: ' + r.sit);
    const n = necResumo(r); if (n) partes.push('Precisa: ' + n);
    if (r.obs) partes.push('Obs.: ' + r.obs);
    if (r.loc) partes.push('GPS: ' + r.loc.join(','));
    return '• ' + partes.join(' | ');
  });
  return `Relatório da equipe ${rel.equipe} – ${dataBR(rel.enviado)}\n${rel.itens.length} aluno(s) com anotações.\n\n${L.join('\n')}\n\n----- DADOS PARA O APP (não apagar) -----\n${JSON.stringify(rel)}`;
}
function renderCompras() {
  const tot = {}, quem = {}, obs = [], sits = {};
  let visit = 0, ausente = 0;
  for (const a of A) {
    const r = rec(a.id); if (!r) continue;
    if (r.st === 'visitado') visit++; if (r.st === 'ausente' || r.st === 'voltar') ausente++;
    for (const [k, q] of Object.entries(r.nec || {})) if (q > 0) { tot[k] = (tot[k] || 0) + q; (quem[k] = quem[k] || []).push(`${a.n} (${q})`); }
    if (r.obs) obs.push([a, r.obs]);
    if (r.sit) sits[r.sit] = (sits[r.sit] || 0) + 1;
  }
  const pendEnvio = Object.values(edits).filter(r => (r.qd || '') > LS.get('enviado', '')).length;
  const ultimo = LS.get('enviado', '');
  $('#tela-compras').innerHTML = `<h2>Compras e relatório</h2>
    <div class="caixa"><h3>Enviar para a coordenação</h3>
      <div class="nota">${pendEnvio ? `<b style="color:var(--verm)">${pendEnvio} anotação(ões) ainda não enviada(s).</b>` : 'Tudo enviado.'}${ultimo ? ' Último envio: ' + dataBR(ultimo) + '.' : ''} As anotações ficam guardadas neste celular até você enviar.</div>
      <button class="btn pri blk" id="cp-email">${ICON.mail} Enviar relatório por e-mail</button>
      <div class="linha-btn"><button class="btn" id="cp-share">Compartilhar arquivo</button><button class="btn" id="cp-baixar">Baixar arquivo</button></div>
      <div class="nota">O e-mail vai para ${EMAIL}. Se o e-mail não abrir, use “Compartilhar arquivo” e escolha o Gmail ou o WhatsApp.</div>
    </div>
    <div class="caixa"><h3>Andamento</h3>
      <div class="item-total"><span>Visitados</span><b>${visit}</b></div>
      <div class="item-total"><span>Ninguém em casa / voltar</span><b>${ausente}</b></div>
      <div class="item-total"><span>A visitar</span><b>${A.length - visit}</b></div>
      ${Object.entries(sits).map(([s, n]) => `<div class="item-total"><span>Casa: ${esc(s)}</span><b>${n}</b></div>`).join('')}
    </div>
    <div class="caixa"><h3>Lista de compras (soma de todas as fichas)</h3>
      ${Object.keys(tot).length ? ITENS.filter(([k]) => tot[k]).map(([k, n]) => `<details class="item-total" style="display:block"><summary style="display:flex;justify-content:space-between"><span>${n}</span><b>${tot[k]}</b></summary><div class="nota">${quem[k].map(esc).join('<br>')}</div></details>`).join('') : '<div class="nota">Nenhuma necessidade anotada ainda.</div>'}
    </div>
    ${obs.length ? `<div class="caixa"><h3>Observações</h3>${obs.map(([a, o]) => `<p style="margin:6px 0"><b>${esc(a.n)}</b>: ${esc(o)}</p>`).join('')}</div>` : ''}
    <button class="btn blk" id="cp-imprimir">${ICON.print} Imprimir lista de compras</button>
    <div class="caixa"><h3>Este celular</h3>
      <div class="nota">Equipe: <b>${esc(equipe)}</b> · Dados dos alunos de ${dataBR(DB.gerado)}</div>
      <div class="linha-btn"><button class="btn" id="cp-equipe">Trocar equipe</button><button class="btn" id="cp-sair">Apagar dados</button></div>
      <div class="nota">“Apagar dados” tira a lista de alunos deste celular (ao terminar a ação). Para atualizar a lista, basta abrir o link novo que o coordenador mandar.</div>
    </div>`;
  const marcar = () => { LS.set('enviado', agora()); atualizarBolhas(); };
  $('#cp-email').onclick = () => {
    const rel = relatorio(); if (!rel.itens.length) return toast('Ainda não há anotações para enviar.');
    const assunto = `Visitas Tupanciretã – ${equipe} – ${dataBR(rel.enviado)}`;
    let corpo = textoRelatorio(rel);
    if (corpo.length > 12000) { toast('Relatório grande: use “Compartilhar arquivo”.'); return; }
    location.href = `mailto:${EMAIL}?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(corpo)}`;
    marcar(); setTimeout(renderCompras, 800);
  };
  const arquivo = () => { const rel = relatorio(); const nome = `visitas-${deac(equipe).replace(/[^a-z0-9]+/g, '-')}-${rel.enviado.slice(0, 16).replace(/[:T]/g, '')}.json`; return new File([JSON.stringify(rel, null, 1)], nome, { type: 'application/json' }); };
  $('#cp-share').onclick = async () => {
    const rel = relatorio(); if (!rel.itens.length) return toast('Ainda não há anotações para enviar.');
    const f = arquivo();
    try {
      if (navigator.canShare && navigator.canShare({ files: [f] })) await navigator.share({ files: [f], title: 'Relatório de visitas', text: `Relatório de visitas – ${equipe}. Enviar para ${EMAIL}` });
      else await navigator.share({ title: 'Relatório de visitas', text: textoRelatorio(rel) });
      marcar(); renderCompras();
    } catch (e) { if (e && e.name !== 'AbortError') toast('Não deu para compartilhar. Use “Baixar arquivo”.'); }
  };
  $('#cp-baixar').onclick = () => {
    if (!Object.keys(edits).length) return toast('Ainda não há anotações para enviar.');
    const f = arquivo(); const u = URL.createObjectURL(f); const l = document.createElement('a'); l.href = u; l.download = f.name; document.body.appendChild(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000);
    marcar(); renderCompras(); toast('Arquivo salvo. Anexe num e-mail para ' + EMAIL);
  };
  $('#cp-imprimir').onclick = () => {
    $('#impressao').innerHTML = `<h1>Lista de compras · Tupanciretã</h1><div class="pq">${new Date().toLocaleDateString('pt-BR')} · soma das fichas registradas neste celular e dos relatórios já recebidos</div>
      <table><thead><tr><th>Item</th><th>Total</th><th>Para quem</th></tr></thead><tbody>${ITENS.filter(([k]) => tot[k]).map(([k, n]) => `<tr><td>${n}</td><td><b>${tot[k]}</b></td><td>${quem[k].map(esc).join('; ')}</td></tr>`).join('') || '<tr><td colspan="3">Nada anotado.</td></tr>'}</tbody></table>
      ${obs.length ? '<h1 style="font-size:13pt;margin-top:6mm">Observações</h1>' + obs.map(([a, o]) => `<p><b>${esc(a.n)}</b> (${esc(endTxt(a, true))}): ${esc(o)}</p>`).join('') : ''}`;
    setTimeout(() => window.print(), 100);
  };
  $('#cp-equipe').onclick = trocarEquipe;
  $('#cp-sair').onclick = () => {
    const n = Object.values(edits).filter(r => (r.qd || '') > LS.get('enviado', '')).length;
    if (n && !confirm(`Há ${n} anotação(ões) ainda não enviada(s). Envie o relatório antes. Apagar mesmo assim?`)) return;
    if (!n && !confirm('Apagar a lista de alunos e as anotações deste celular?')) return;
    ['dados', 'edits', 'sel', 'enviado'].forEach(k => LS.del(k)); location.reload();
  };
}

/* ---------- navegação ---------- */
let telaAtual = 'roteiro';
function irPara(t) {
  telaAtual = t;
  document.querySelectorAll('section.tela').forEach(s => s.classList.toggle('hide', s.id !== 'tela-' + t));
  document.querySelectorAll('nav button').forEach(b => b.setAttribute('aria-current', b.dataset.tela === t ? 'page' : 'false'));
  renderAtual(); window.scrollTo(0, 0);
}
function renderAtual() {
  if (telaAtual === 'alunos') renderLista();
  if (telaAtual === 'mapa') iniciarMapa();
  if (telaAtual === 'roteiro') renderRoteiro();
  if (telaAtual === 'compras') renderCompras();
}
function atualizarBolhas() {
  const b = $('#bolha-rot'); b.textContent = sel.length; b.classList.toggle('hide', !sel.length);
  const n = Object.values(edits).filter(r => (r.qd || '') > LS.get('enviado', '')).length;
  const e = $('#bolha-env'); e.textContent = n; e.classList.toggle('hide', !n);
}
function trocarEquipe() {
  const v = prompt('Nome da sua equipe:', equipe); if (v && v.trim()) { equipe = v.trim(); LS.set('equipe', equipe); $('#bt-equipe').textContent = equipe; renderAtual(); }
}

/* ---------- início ---------- */
let ruasProntas = false;
function entrar(d) {
  DB = d; EMAIL = DB.contato || '';
  A = DB.alunos; byId = Object.fromEntries(A.map(a => [a.id, a]));
  sel = sel.filter(id => byId[id]);
  if (!ruasProntas) { carregarRuas(); ruasProntas = true; }
  localizarTodos(); montarFiltros();
  $('#entrada').classList.add('hide');
  $('#bt-equipe').textContent = equipe || 'Equipe';
  $('#sub-topo').textContent = `${A.length} alunos · IFFar Júlio de Castilhos`;
  atualizarBolhas(); renderAtual();
}
function mostrarEntrada(temDados) {
  $('#entrada').classList.remove('hide');
  $('#sem-dados').classList.toggle('hide', temDados);
  $('#com-dados').classList.toggle('hide', !temDados);
  $('#in-equipe').required = temDados;
}
function ligarEventos() {
  $('#nav').onclick = e => { const b = e.target.closest('button'); if (b) irPara(b.dataset.tela); };
  $('#bt-equipe').onclick = trocarEquipe;
  let tq; $('#busca').oninput = e => { clearTimeout(tq); tq = setTimeout(() => { filtro.q = e.target.value; renderLista(); }, 150); };
  $('#seg-status').onclick = e => { const b = e.target.closest('button'); if (!b) return; filtro.st = b.dataset.v; document.querySelectorAll('#seg-status button').forEach(x => x.setAttribute('aria-pressed', x === b)); renderLista(); };
  $('#f-bairro').onchange = e => { filtro.bairro = e.target.value; renderLista(); };
  $('#f-curso').onchange = e => { filtro.curso = e.target.value; renderLista(); };
  $('#f-nivel').onchange = e => { filtro.nivel = e.target.value; renderLista(); };
  $('#f-ordem').onchange = e => { filtro.ordem = e.target.value; renderLista(); };
  $('#bt-add-todos').onclick = () => {
    const L = filtrados().filter(a => !sel.includes(a.id));
    if (!L.length) return toast('Todos do filtro já estão no roteiro.');
    if (L.length > 30 && !confirm(`Incluir ${L.length} alunos no roteiro?`)) return;
    sel = sel.concat(L.map(a => a.id)); salvarSel(); renderLista(); toast(`${L.length} incluído(s) no roteiro`);
  };
  $('#lista').onclick = e => {
    const card = e.target.closest('.card'); if (!card) return; const id = card.dataset.id;
    if (e.target.closest('.chk')) { alternarSel(id); renderLista(); } else abrirFicha(id);
  };
  $('#bt-fecha-ficha').onclick = () => history.back();
  window.addEventListener('popstate', () => { if (fichaId) fecharFicha(); });
  $('#form-entrada').onsubmit = e => {
    e.preventDefault();
    const eq = $('#in-equipe').value.trim(); if (!eq || !DADOS_PEND) return;
    equipe = eq; LS.set('equipe', eq); entrar(DADOS_PEND);
  };
  $('#in-arquivo').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const d = JSON.parse(await f.text());
      if (!dadosValidos(d)) throw new Error('formato');
      guardarDados(d); DADOS_PEND = LS.get('dados', d);
      if (equipe) entrar(DADOS_PEND); else mostrarEntrada(true);
    } catch (err) { $('#erro-entrada').textContent = 'Este arquivo não é a lista de alunos do app.'; }
  };
}
let DADOS_PEND = null;
ligarEventos();
(async () => {
  $('#in-equipe').value = equipe;
  DADOS_PEND = await obterDados();
  if (DADOS_PEND && equipe) entrar(DADOS_PEND);
  else mostrarEntrada(!!DADOS_PEND);
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
})();
// abrir um link novo de dados com o app já aberto
window.addEventListener('hashchange', async () => { if (location.hash.startsWith('#d=')) { const d = await obterDados(); if (d) { DADOS_PEND = d; if (equipe) entrar(d); else mostrarEntrada(true); } } });

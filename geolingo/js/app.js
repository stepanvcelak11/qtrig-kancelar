// Geolingo – uživatelské rozhraní: mapa lekcí, cvičení, terénní praxe, profil.

import { UNITS, LESSONS, lessonById, buildLesson, buildCalcPractice, buildFieldPractice, buildMistakes, buildMix, grade, correctText, prepare, shuffle } from './engine.js';
import { fmt, generate } from './generators.js';
import { W, H, checkField, solutionCells, turnScrew, SCREWS, FIELD_TYPES } from './field.js';
import * as store from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isField = (t) => FIELD_TYPES.includes(t);

// ---------------------------------------------------------------------------------------
// Maskot Toti (totální stanice na stativu) – přesně podle předlohy.

function mascot(mood = 'happy', cls = '') {
  // Oči na displeji: normální ovály, smutné = přivřené, překvapené = větší.
  const eh = mood === 'sad' ? 26 : mood === 'wow' ? 66 : 55;
  const ey = mood === 'sad' ? 482 : 480 - eh / 2;
  return `<svg class="toti ${cls}" viewBox="60 90 720 870" aria-hidden="true">
    <g stroke-linecap="round">
      <line x1="355" y1="650" x2="118" y2="928" stroke="#b87a38" stroke-width="32"/>
      <line x1="355" y1="650" x2="592" y2="928" stroke="#b87a38" stroke-width="32"/>
      <line x1="355" y1="650" x2="355" y2="930" stroke="#a86a30" stroke-width="34"/>
    </g>
    <rect x="75" y="916" width="88" height="24" rx="12" fill="#6f7480"/>
    <rect x="548" y="916" width="88" height="24" rx="12" fill="#6f7480"/>
    <rect x="252" y="548" width="208" height="62" rx="14" fill="#3d4452"/>
    <rect x="245" y="605" width="222" height="48" rx="18" fill="#6f7480"/>
    <path d="M245 168 Q355 70 470 168" fill="none" stroke="#3d4452" stroke-width="22" stroke-linecap="round"/>
    <rect x="178" y="395" width="355" height="160" rx="30" fill="#f2c230" stroke="#c9981c" stroke-width="5"/>
    <rect x="175" y="165" width="90" height="272" rx="30" fill="#f2c230" stroke="#c9981c" stroke-width="5"/>
    <rect x="447" y="165" width="93" height="272" rx="30" fill="#f2c230" stroke="#c9981c" stroke-width="5"/>
    <rect x="245" y="428" width="220" height="102" rx="20" fill="#0f1c2a"/>
    <rect class="eye" x="290" y="${ey}" width="42" height="${eh}" rx="18" fill="#6ce5ff"/>
    <rect class="eye" x="378" y="${ey}" width="42" height="${eh}" rx="18" fill="#6ce5ff"/>
    <rect x="190" y="262" width="52" height="64" rx="20" fill="#1e2430"/>
    <path d="M232 262 Q232 240 262 239 L530 232 L530 342 L262 338 Q232 337 232 315 Z" fill="#2e9a6a" stroke="#237a53" stroke-width="5"/>
    <circle cx="355" cy="288" r="35" fill="#f2c230" stroke="#c9981c" stroke-width="5"/>
    <rect x="520" y="222" width="57" height="126" rx="26" fill="#1e2430"/>
    <line class="laser" x1="590" y1="283" x2="748" y2="277" stroke="#d9434e" stroke-width="7" stroke-linecap="round"/>
    <circle class="laser" cx="748" cy="277" r="14" fill="#d9434e"/>
    <circle cx="572" cy="283" r="26" fill="#93c5fd"/>
  </svg>`;
}

// ---------------------------------------------------------------------------------------
// Ikony (vlastní SVG, žádné emoji v ovládání)

const ICON = {
  map: '<svg viewBox="0 0 24 24"><path d="M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2Z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="2"/></svg>',
  field: '<svg viewBox="0 0 24 24"><rect x="8" y="3" width="8" height="7" rx="2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M12 10v3M12 13 6 21M12 13l6 8M12 13v8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21c1-4.5 4.5-6.5 8-6.5s7 2 8 6.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
  flame: '<svg viewBox="0 0 24 24"><path d="M12 2c1 4 6 6 6 12a6 6 0 0 1-12 0c0-3 1.5-5 3-6 0 2 1 3 2 3 0-4-1-6 1-9Z" fill="#f08a24"/><path d="M12 13c1 2 3 2.5 3 5a3 3 0 0 1-6 0c0-1.5 1-2.5 2-3 0 1 .5 1.5 1 1.5 0-1.5-.5-2.5 0-3.5Z" fill="#ffd166"/></svg>',
  star: '<svg viewBox="0 0 24 24"><path d="m12 2 2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.1l-6 3.3 1.3-6.7-5-4.7 6.8-.8L12 2Z" fill="#f2c230" stroke="#c9981c" stroke-width="1.2" stroke-linejoin="round"/></svg>',
};

/** Baterie přístroje místo srdíček: 5 dílků. */
function battery(n, max = store.MAX_HEARTS) {
  const col = n >= 3 ? '#16a37f' : n >= 2 ? '#f08a24' : '#e5484d';
  const cells = Array.from({ length: max }, (_, i) => `<rect x="${3 + i * 4.2}" y="7" width="3.2" height="10" rx="1" fill="${i < n ? col : 'var(--cell-off)'}"/>`).join('');
  return `<svg class="batt" viewBox="0 0 28 24"><rect x="1" y="5" width="23" height="14" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="24.5" y="9.5" width="2.5" height="5" rx="1" fill="currentColor"/>${cells}</svg>`;
}

// ---------------------------------------------------------------------------------------
// Zvuky (Web Audio, bez souborů)

let audio = null;
function beep(kind) {
  if (!store.S().sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'ok' ? [[740, 0], [988, 0.08]] : kind === 'done' ? [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.32]]
      : kind === 'tick' ? [[1400, 0]] : [[220, 0], [175, 0.12]];
    for (const [f, t] of notes) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = kind === 'bad' ? 'sawtooth' : kind === 'tick' ? 'square' : 'triangle'; o.frequency.value = f;
      const vol = kind === 'tick' ? 0.03 : 0.16, len = kind === 'tick' ? 0.03 : 0.18;
      g.gain.setValueAtTime(0.0001, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(vol, audio.currentTime + t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + len);
      o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + len + 0.02);
    }
  } catch { /* bez zvuku */ }
  if (kind !== 'tick') navigator.vibrate?.(kind === 'bad' ? [30, 40, 30] : 12);
}

function toast(text) {
  const t = $('#toast');
  t.textContent = text; t.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => t.classList.add('hidden'), 2400);
}

// ---------------------------------------------------------------------------------------
// Navigace

let tab = 'path';

function topStats() {
  const s = store.S();
  const goal = Math.min(1, s.xpToday / s.dailyGoal);
  return `<header class="top"><div class="top-in">
    <div class="brand">${mascot('happy', 'mini')}<span>Geo<b>lingo</b></span></div>
    <div class="chips">
      <div class="chip" title="Dní v terénu v řadě">${ICON.flame}<b>${s.streak}</b></div>
      <div class="chip" title="Zkušenosti (dnes ${s.xpToday} / ${s.dailyGoal} XP)" style="--p:${goal}">${ICON.star}<b>${s.xp}</b><i class="goalbar"></i></div>
      <div class="chip batt-chip" title="Baterie přístroje – za chybu ubude dílek">${battery(s.hearts)}</div>
    </div></div>
  </header>`;
}

function tabs() {
  const b = (id, ic, label) => `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${ICON[ic]}<span>${label}</span></button>`;
  return `<nav class="tabs"><div>${b('path', 'map', 'Mapa')}${b('practice', 'field', 'Terén')}${b('profile', 'user', 'Profil')}</div></nav>`;
}

let scrollMemory = null;
function show(which) {
  tab = which;
  store.tick();
  if (which === 'path') renderPath();
  else if (which === 'practice') renderPractice();
  else renderProfile();
  if (which === 'path' && scrollMemory == null) {
    $('.node.current')?.scrollIntoView({ block: 'center' });
  } else window.scrollTo(0, which === 'path' ? scrollMemory : 0);
}

app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { if (tab === 'path') scrollMemory = window.scrollY; show(t.dataset.tab); }
});

// ---------------------------------------------------------------------------------------
// Mapa lekcí: kapitoly jako mapové listy, lekce jako měřické body spojené pořadem

const isDone = (id) => (store.S().done[id] ?? 0) > 0;
const levelOf = (l) => l.unit.level ?? 'SŠ';
const isUni = (lvl) => lvl !== 'SŠ';
const firstVs = () => LESSONS.findIndex((l) => isUni(levelOf(l)));

// Oddíly mapy podle úrovně studia.
const LEVELS = {
  'VŠ': { icon: '🎓', title: 'Vysokoškolská nadstavba', desc: 'Vyšší a fyzikální geodézie, vyrovnání, fotogrammetrie, družicová geodézie, sítě a deformace.' },
  'Bc.': { icon: '🎓', title: 'Bakalářské studium', desc: 'Obsah odpovídá bakalářskému programu Geodézie a kartografie (VUT FAST).' },
  'Ing.': { icon: '🏛️', title: 'Inženýrské studium', desc: 'Navazující magisterský program Geodézie a kartografie (VUT FAST).' },
};

function isUnlocked(index) {
  const s = store.S();
  if (s.unlockAll || index === 0 || isDone(LESSONS[index - 1].id)) return true;
  // Vysokoškoláci mají VŠ nadstavbu otevřenou hned od začátku.
  return s.track === 'vs' && index === firstVs();
}
function currentIndex() {
  const s = store.S();
  const order = LESSONS.map((l, i) => i);
  if (s.track === 'vs') order.sort((a, b) => isUni(levelOf(LESSONS[b])) - isUni(levelOf(LESSONS[a])) || a - b);
  const i = order.find((k) => isUnlocked(k) && !isDone(LESSONS[k].id));
  return i ?? LESSONS.length - 1;
}

const ZIGZAG = [0, 62, 88, 62, 0, -62, -88, -62];
const ROW = 118;

function renderPath() {
  const cur = currentIndex();
  let k = 0, lastLevel = 'SŠ';
  const html = UNITS.map((u, ui) => {
    const lvl = u.level ?? 'SŠ';
    let divider = '';
    if (lvl !== lastLevel && LEVELS[lvl]) {
      const L = LEVELS[lvl];
      divider = `<div class="divider" id="lvl-${ui}"><span>${L.icon}</span><div><b>${L.title}</b><small>${L.desc}</small></div></div>`;
    }
    lastLevel = lvl;
    const doneN = u.lessons.filter((l) => isDone(l.id)).length;
    const pts = u.lessons.map((_, li) => ({ x: ZIGZAG[(ui * 5 + li) % ZIGZAG.length], y: li * ROW + 44 }));
    const nodes = u.lessons.map((l, li) => {
      const index = k++;
      const done = isDone(l.id), unlocked = isUnlocked(index);
      const cls = done ? 'done' : !unlocked ? 'locked' : index === cur ? 'current' : 'open';
      const times = store.S().done[l.id] ?? 0;
      const hasField = (l.gens ?? []).some(isField);
      const p = pts[li];
      return `<div class="node-wrap" style="top:${p.y}px;left:calc(50% + ${p.x}px)">
          ${index === cur ? `<div class="toti-here" style="${p.x > 0 ? 'right:128px' : 'left:128px'}">${mascot('happy')}<span class="start-tip">${done ? 'Opakovat' : 'Start'}</span></div>` : ''}
          <button class="node ${cls}" data-lesson="${l.id}" aria-label="${esc(l.title)}"><span class="ic">${unlocked ? l.icon : '🔒'}</span>
            ${times ? `<span class="times">${times > 1 ? '×' + Math.min(times, 9) : '✓'}</span>` : ''}${hasField ? '<span class="fieldmark" title="Obsahuje terénní úlohu">🦺</span>' : ''}</button>
          <div class="node-label">${esc(l.title)}</div></div>`;
    }).join('');
    // Spojnice bodů jako polygonový pořad: hotové úseky plnou čarou.
    const seg = pts.slice(1).map((p, i) => {
      const a = pts[i], solid = isDone(u.lessons[i].id);
      return `<line x1="${a.x}" y1="${a.y + 36}" x2="${p.x}" y2="${p.y + 36}" class="${solid ? 'solid' : ''}"/>`;
    }).join('');
    return `${divider}<section class="unit" id="unit-${ui}" style="--c:${u.color}">
      <div class="sheet-head">
        <div class="sheet-meta"><span class="sheet-no">List ${String(ui + 1).padStart(2, '0')}</span><span class="lvl ${isUni(lvl) ? 'vs' : ''}">${lvl}</span></div>
        <h2>${esc(u.title)}</h2><p>${esc(u.desc)}</p>
        <div class="sheet-prog"><i style="width:${(doneN / u.lessons.length) * 100}%"></i></div><small>${doneN} / ${u.lessons.length} lekcí</small>
        <svg class="contours" viewBox="0 0 120 80" aria-hidden="true"><path d="M10 70c20-30 40-10 60-35s35-20 45-30M0 78c25-25 45-5 68-28s32-18 52-26M25 80c15-15 30-5 45-20s30-12 50-18"/></svg>
        <svg class="north" viewBox="0 0 20 30" aria-hidden="true"><path d="M10 2 16 22 10 18 4 22Z"/><text x="10" y="30">S</text></svg>
      </div>
      <div class="nodes" style="height:${u.lessons.length * ROW - 20}px"><svg class="traverse" width="1" height="${u.lessons.length * ROW}">${seg}</svg>${nodes}</div>
    </section>`;
  }).join('');
  app.innerHTML = topStats() + `<main class="path">${html}<div class="path-end">${mascot('wow')}<p>Konec mapy – jsi připraven do terénu!</p></div></main>
    <button class="index-btn" id="index" aria-label="Klad mapových listů">${ICON.map}<span>Listy</span></button>` + tabs();
  app.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => lessonSheet(b.dataset.lesson)));
  $('#index').addEventListener('click', indexSheet);
}

/** Klad mapových listů: rychlý skok na kapitolu. */
function indexSheet() {
  let last = null;
  const rows = UNITS.map((u, ui) => {
    const lvl = u.level ?? 'SŠ';
    const head = lvl !== last ? `<h4>${lvl === 'SŠ' ? 'Střední škola' : LEVELS[lvl]?.title ?? lvl}</h4>` : '';
    last = lvl;
    const doneN = u.lessons.filter((l) => isDone(l.id)).length;
    return `${head}<button class="idx" data-unit="${ui}" style="--c:${u.color}"><span class="no">${String(ui + 1).padStart(2, '0')}</span><span class="grow">${esc(u.title)}</span><span class="pr">${doneN}/${u.lessons.length}</span></button>`;
  }).join('');
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet index-sheet" style="--c:var(--petrol)"><h3>Klad mapových listů</h3><div class="idx-list">${rows}</div></div>`;
  document.body.append(bg);
  bg.addEventListener('click', (e) => {
    if (e.target === bg) return bg.remove();
    const b = e.target.closest('[data-unit]');
    if (b) { bg.remove(); document.getElementById(`unit-${b.dataset.unit}`).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
}

function lessonSheet(id) {
  const l = lessonById(id);
  const index = LESSONS.indexOf(l);
  const unlocked = isUnlocked(index), times = store.S().done[id] ?? 0;
  const field = (l.gens ?? []).filter(isField), calc = (l.gens ?? []).filter((g) => !isField(g));
  const tags = [`${l.items.length} otázek`, calc.length ? 'výpočty s novými čísly' : '', field.length ? 'terénní úloha' : ''].filter(Boolean);
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" style="--c:${l.unit.color}">
    <div class="sheet-top"><span class="ic">${l.icon}</span><div><small>${esc(l.unit.title)} · ${levelOf(l)}</small><h3>${esc(l.title)}</h3></div></div>
    <div class="tags">${tags.map((t) => `<span>${t}</span>`).join('')}</div>
    ${times ? `<p class="hint">Dokončeno ${times}× ${store.S().perfect[id] ? '· bez chyby 💯' : ''}</p>` : ''}
    ${unlocked ? `<button class="btn primary wide" id="go">${times ? 'Opakovat lekci · +10 XP' : 'Začít lekci · +10 XP'}</button>`
      : '<button class="btn wide" disabled>🔒 Nejdřív dokonči předchozí lekci</button>'}
  </div>`;
  document.body.append(bg);
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
  $('#go', bg)?.addEventListener('click', () => { bg.remove(); scrollMemory = window.scrollY; startLesson(id); });
}

// ---------------------------------------------------------------------------------------
// Běh lekce

let run = null;

function startLesson(id) {
  store.tick();
  if (store.S().hearts <= 0) return noHearts();
  const l = lessonById(id);
  begin(buildLesson(l), { lessonId: id, title: l.title, practice: false, color: l.unit.color });
}

function startPractice(items, title) {
  if (!items.length) { toast('Zatím tu nic není'); return; }
  begin(items, { lessonId: null, title, practice: true, color: '#2b8fd6' });
}

function begin(items, meta) {
  run = { items, i: 0, mistakes: 0, correct: 0, retried: new Set(), meta, answer: null, locked: false, started: Date.now(), combo: 0 };
  renderExercise();
}

const KIND = {
  c: 'Vyber správnou odpověď', tf: 'Pravda, nebo ne?', m: 'Spoj dvojice', o: 'Seřaď kroky', n: 'Vypočítej', rod: 'Odečti lať',
  station: 'Terén · výběr stanoviska', levelSetup: 'Terén · nivelace ze středu', stakeout: 'Terén · vytyčení', bubble: 'Terén · urovnání libely', fieldbook: 'Terén · zápisník',
};

function renderExercise() {
  const ex = run.items[run.i];
  run.answer = null; run.locked = false;
  const pct = Math.round((run.i / run.items.length) * 100);
  app.innerHTML = `<div class="lesson" style="--c:${run.meta.color}">
    <div class="lesson-top"><button class="x" id="quit" aria-label="Ukončit">✕</button>
      <div class="bar"><i style="width:${pct}%"></i>${run.combo >= 3 ? `<em>${run.combo}× v řadě</em>` : ''}</div>
      ${run.meta.practice ? '<span class="chip small">🎯</span>' : `<span class="chip small">${battery(store.S().hearts)}</span>`}</div>
    <div class="ex ${isField(ex.t) ? 'field' : ''}"><div class="kind ${isField(ex.t) ? 'terrain' : ''}">${KIND[ex.t]}</div>${exerciseBody(ex)}</div>
    ${ex.t === 'm' ? '' : '<div class="check-bar"><div><button class="btn primary wide" id="check" disabled>Zkontrolovat</button></div></div>'}
  </div>`;
  $('#quit').addEventListener('click', () => { if (confirm('Opravdu ukončit? Pokrok v lekci se neuloží.')) { run = null; show(tab); } });
  $('#check')?.addEventListener('click', check);
  wireExercise(ex);
}

function exerciseBody(ex) {
  switch (ex.t) {
    case 'c':
      return `<div class="mascot-row">${mascot()}<div class="bubble">${esc(ex.q)}</div></div>
        <div class="opts">${ex.options.map((o, i) => `<button class="opt" data-i="${i}"><span class="key">${'ABCDE'[i]}</span>${esc(o)}</button>`).join('')}</div>`;
    case 'tf':
      return `<div class="mascot-row">${mascot()}<div class="bubble">${esc(ex.q)}</div></div>
        <div class="tf"><button class="opt" data-v="1"><b>✓</b>Pravda</button><button class="opt" data-v="0"><b>✗</b>Nepravda</button></div>`;
    case 'm':
      return `<p class="prompt">${esc(ex.q)}</p>
        <div class="match"><div class="col">${ex.left.map((s) => `<button class="opt" data-side="l" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <div class="col">${ex.right.map((s) => `<button class="opt" data-side="r" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
    case 'o':
      return `<p class="prompt">${esc(ex.q)}</p><div class="answer-zone tiles" id="zone"></div><div class="tiles" id="bank"></div>`;
    case 'n':
      return `<div class="calc-card"><p class="prompt">${esc(ex.q)}</p></div>
        <div class="numrow"><input class="num" id="num" inputmode="decimal" autocomplete="off" placeholder="Výsledek"><span class="unit-label">${esc(ex.unit ?? '')}</span></div>
        <div class="hint">Zaokrouhli na ${ex.dec} ${ex.dec === 1 ? 'desetinné místo' : ex.dec >= 2 && ex.dec <= 4 ? 'desetinná místa' : 'desetinných míst'}${ex.dec === 0 ? ' (celé číslo)' : ''}. Čárka i tečka jsou v pořádku.</div>`;
    case 'rod':
      return `<p class="prompt">Jaké je čtení na lati na vodorovném vlákně nitkového kříže?</p>
        <canvas class="rod" id="rodCanvas" width="600" height="600"></canvas>
        <div class="numrow"><input class="num" id="num" inputmode="decimal" autocomplete="off" placeholder="např. 1,437"><span class="unit-label">m</span></div>
        <div class="hint">Číslo na lati = decimetry (spodní okraj čísla je celý dm), políčka = centimetry, milimetry odhadni.</div>`;
    case 'station':
      return `<p class="prompt">Kam postavíš totální stanici, abys z jednoho stanoviska zaměřil body ${ex.targets.map((t) => t.n).join(', ')}?</p>
        <div class="hint">Dosah dálkoměru ${ex.range} m. Klepni do mapy.</div>${mapSvg(ex)}${legend(ex)}`;
    case 'levelSetup':
      return `<p class="prompt">Kam postavíš nivelační přístroj pro měření z latě A na lať B?</p>
        <div class="hint">Délky záměr max. ${ex.maxSight} m, rozdíl délek vzad a vpřed max. ${ex.maxDiff} m. Klepni do mapy.</div>${mapSvg(ex)}${legend(ex)}`;
    case 'stakeout':
      return `<p class="prompt">Vytyč bod P polární metodou.</p>
        <div class="given"><span>Stanovisko <b>S</b>, orientace na <b>O</b></span><span>ω = <b>${fmt(ex.omega, 2)} gon</b> (od O po směru hod.)</span><span>d = <b>${fmt(ex.d, 2)} m</b></span></div>
        <div class="hint">Klepni tam, kam figurant postaví hranol (tolerance ${fmt(ex.tolM, 1)} m, mřížka 10 m).</div>${mapSvg(ex)}`;
    case 'bubble':
      return `<p class="prompt">Urovnej krabicovou libelu stavěcími šrouby – dostaň bublinu do kroužku.</p>${bubbleSvg(ex)}
        <div class="screws">${SCREWS.map((_, i) => `<div class="screw"><small>Šroub ${i + 1}</small><button class="btn" data-screw="${i}" data-dir="1">▲ zvednout</button><button class="btn" data-screw="${i}" data-dir="-1">▼ snížit</button></div>`).join('')}</div>`;
    case 'fieldbook':
      return `<p class="prompt">Dopočítej nivelační zápisník.</p>
        <div class="book"><table><thead><tr><th>Stan.</th><th>Vzad</th><th>Vpřed</th><th>Δh [m]</th></tr></thead><tbody>
        ${ex.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${fmt(r.z, 3)}</td><td>${fmt(r.p, 3)}</td><td><input class="cell" data-cell="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3">H<sub>Z</sub> = ${fmt(ex.HZ, 3)} m → H<sub>K</sub> =</td><td><input class="cell" data-cell="${ex.rows.length}" inputmode="decimal" autocomplete="off"></td></tr></tfoot></table></div>
        <div class="hint">Na 3 desetinná místa (mm). Znaménko převýšení je důležité.</div>`;
    default: return '';
  }
}

// --- Mapa pro terénní úlohy -------------------------------------------------------------

function mapSvg(ex) {
  const grid = [];
  for (let x = 10; x < W; x += 10) grid.push(`<line x1="${x}" y1="0" x2="${x}" y2="${H}"/>`);
  for (let y = 10; y < H; y += 10) grid.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}"/>`);
  const s = ex.scene ?? { buildings: [], trees: [] };
  const bld = s.buildings.map((b) => `<g class="bld"><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx=".6"/><path d="M${b.x} ${b.y}L${b.x + b.w} ${b.y + b.h}M${b.x + b.w} ${b.y}L${b.x} ${b.y + b.h}"/></g>`).join('');
  const trees = s.trees.map((t) => `<g class="tree"><circle cx="${t.x}" cy="${t.y}" r="${t.r}"/><circle cx="${t.x - t.r * 0.25}" cy="${t.y - t.r * 0.25}" r="${t.r * 0.45}" class="hl"/></g>`).join('');
  let items = '';
  if (ex.t === 'station') items = ex.targets.map((t) => `<g class="tgt"><circle cx="${t.x}" cy="${t.y}" r="1.5"/><text x="${t.x + 2.2}" y="${t.y - 1.6}">${t.n}</text></g>`).join('');
  if (ex.t === 'levelSetup') items = [ex.A, ex.B].map((t) => `<g class="rodmk"><rect x="${t.x - 0.9}" y="${t.y - 3.2}" width="1.8" height="6.4" rx=".3"/><rect x="${t.x - 0.9}" y="${t.y - 1.6}" width="1.8" height="1.6" class="red"/><rect x="${t.x - 0.9}" y="${t.y + 1.6}" width="1.8" height="1.6" class="red"/><text x="${t.x + 2}" y="${t.y - 2.4}">${t.n}</text></g>`).join('');
  if (ex.t === 'stakeout') {
    items = `<line x1="${ex.S.x}" y1="${ex.S.y}" x2="${ex.O.x}" y2="${ex.O.y}" class="orient"/>
      <g class="tgt o"><circle cx="${ex.O.x}" cy="${ex.O.y}" r="1.6"/><path d="M${ex.O.x - 2.4} ${ex.O.y}h4.8M${ex.O.x} ${ex.O.y - 2.4}v4.8"/><text x="${ex.O.x + 2.4}" y="${ex.O.y - 1.8}">O</text></g>
      ${tripod(ex.S.x, ex.S.y, 'S')}`;
  }
  return `<div class="mapbox"><svg class="map" id="map" viewBox="0 0 ${W} ${H}">
    <defs><pattern id="grass" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" class="g0"/><path d="M1 5l1-2M4 2l1-2" class="g1"/></pattern></defs>
    <rect width="${W}" height="${H}" fill="url(#grass)"/>
    <g class="grid">${grid.join('')}</g>${bld}${trees}<g id="ov"></g>${items}<g id="mk"></g>
    <g class="scalebar" transform="translate(${W - 24} ${H - 4})"><rect width="10" height="1.2"/><rect x="10" width="10" height="1.2" class="w"/><text x="0" y="-1.2">0</text><text x="17" y="-1.2">20 m</text></g>
    <g class="northar" transform="translate(${W - 5} 4)"><path d="M0 -3 2 3 0 2 -2 3Z"/><text y="7.5">S</text></g>
  </svg></div>`;
}

const tripod = (x, y, label = '', cls = '') => `<g class="tripod ${cls}"><path d="M${x} ${y}l-2.2 3.2M${x} ${y}l2.2 3.2M${x} ${y}v3.6"/><circle cx="${x}" cy="${y - 0.4}" r="1.3"/>${label ? `<text x="${x + 2.4}" y="${y - 1.4}">${label}</text>` : ''}</g>`;
const prism = (x, y, cls = '') => `<g class="prism ${cls}"><circle cx="${x}" cy="${y}" r="1.4"/><path d="M${x - 2.2} ${y}h4.4M${x} ${y - 2.2}v4.4"/></g>`;

function legend(ex) {
  const items = ex.t === 'station'
    ? ['<i class="lg-t"></i>měřené body', '<i class="lg-b"></i>budova', '<i class="lg-tr"></i>strom (zakrývá výhled)']
    : ['<i class="lg-r"></i>nivelační lať', '<i class="lg-tr"></i>strom', '<i class="lg-b"></i>budova'];
  return `<div class="legend">${items.map((i) => `<span>${i}</span>`).join('')}</div>`;
}

function svgPoint(svg, e) {
  const pt = svg.createSVGPoint();
  pt.x = e.clientX; pt.y = e.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function drawFieldResult(ex, detail) {
  const ov = $('#ov'), mk = $('#mk');
  if (!ov) return;
  const p = run.answer;
  if (ex.t === 'station' || ex.t === 'levelSetup') {
    ov.innerHTML = solutionCells(ex).map((c) => `<rect class="okcell" x="${c.x - c.s / 2}" y="${c.y - c.s / 2}" width="${c.s}" height="${c.s}"/>`).join('');
    mk.innerHTML = (detail.rays ?? []).map((r) => `<line class="ray ${r.ok ? 'good' : 'bad'}" x1="${p.x}" y1="${p.y}" x2="${r.to.x}" y2="${r.to.y}"/>`).join('')
      + tripod(p.x, p.y, '', detail.ok ? 'good' : 'bad');
  }
  if (ex.t === 'stakeout') {
    const P = ex.P;
    ov.innerHTML = `<circle class="tol" cx="${P.x}" cy="${P.y}" r="${ex.tolM}"/><line class="ray good" x1="${ex.S.x}" y1="${ex.S.y}" x2="${P.x}" y2="${P.y}"/>`;
    mk.innerHTML = `<line class="miss" x1="${p.x}" y1="${p.y}" x2="${P.x}" y2="${P.y}"/>${prism(P.x, P.y, 'good')}${prism(p.x, p.y, detail.ok ? 'good' : 'bad')}<text class="plabel" x="${P.x + 2.4}" y="${P.y - 1.8}">P</text>`;
  }
}

// --- Libela ----------------------------------------------------------------------------

function bubbleSvg() {
  const screws = SCREWS.map((s, i) => `<g class="screwg" id="sc${i}" transform="translate(${s.ux * 50} ${s.uy * 50})"><circle r="8"/><path class="knurl" d="M-8 0h16M0 -8v16"/><text y="-11">${i + 1}</text></g>`).join('');
  return `<svg class="vial" viewBox="-66 -70 132 132">
    <path class="plate" d="${SCREWS.map((s, i) => `${i ? 'L' : 'M'}${s.ux * 50} ${s.uy * 50}`).join('')}Z"/>
    ${screws}
    <circle class="glass" r="30"/><circle class="ring" r="9"/><circle class="ring2" r="18"/>
    <circle class="bub" id="bub" r="6"/>
  </svg>`;
}

function setBubble(b) {
  const el = $('#bub');
  const r = Math.hypot(b.x, b.y), k = r > 0.8 ? 0.8 / r : 1;   // bublina se zastaví o okraj
  el.setAttribute('transform', `translate(${b.x * k * 30} ${b.y * k * 30})`);
  el.classList.toggle('in', r <= run.items[run.i].okR);
}

// --- Zapojení cvičení --------------------------------------------------------------------

function wireExercise(ex) {
  const checkBtn = $('#check');
  const setAnswer = (v) => { run.answer = v; if (checkBtn) checkBtn.disabled = v == null || v === ''; };

  if (ex.t === 'c' || ex.t === 'tf') {
    app.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
      if (run.locked) return;
      app.querySelectorAll('.opt').forEach((o) => o.classList.remove('sel'));
      b.classList.add('sel');
      setAnswer(ex.t === 'c' ? ex.options[+b.dataset.i] : b.dataset.v === '1');
    }));
  }

  if (ex.t === 'n' || ex.t === 'rod') {
    const input = $('#num');
    input.addEventListener('input', () => setAnswer(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !checkBtn.disabled) check(); });
    if (ex.t === 'rod') drawRod($('#rodCanvas'), ex.a);
    setTimeout(() => input.focus({ preventScroll: true }), 50);
  }

  if (ex.t === 'o') {
    const zone = $('#zone'), bank = $('#bank');
    const order = [];
    const draw = () => {
      zone.innerHTML = order.map((s, i) => `<button class="tile" data-z="${i}"><span class="n">${i + 1}</span>${esc(s)}</button>`).join('')
        || '<div class="hint empty">Klepej na kroky ve správném pořadí…</div>';
      bank.innerHTML = ex.bank.filter((s) => !order.includes(s)).map((s) => `<button class="tile" data-b="${esc(s)}">${esc(s)}</button>`).join('');
      zone.querySelectorAll('[data-z]').forEach((b) => b.addEventListener('click', () => { if (!run.locked) { order.splice(+b.dataset.z, 1); draw(); } }));
      bank.querySelectorAll('[data-b]').forEach((b) => b.addEventListener('click', () => { if (!run.locked) { order.push(b.dataset.b); draw(); } }));
      setAnswer(order.length === ex.s.length ? order.slice() : null);
    };
    draw();
  }

  if (ex.t === 'm') {
    const pairs = new Map(ex.p);
    let sel = null, matched = 0, errors = 0;
    app.querySelectorAll('.match .opt').forEach((b) => b.addEventListener('click', () => {
      if (b.disabled) return;
      if (!sel || sel.dataset.side === b.dataset.side) {
        app.querySelectorAll('.match .opt').forEach((o) => o.classList.remove('sel'));
        sel = b; b.classList.add('sel'); return;
      }
      const l = sel.dataset.side === 'l' ? sel : b, r = sel.dataset.side === 'l' ? b : sel;
      if (pairs.get(l.dataset.v) === r.dataset.v) {
        [l, r].forEach((x) => { x.classList.remove('sel'); x.classList.add('good'); x.disabled = true; });
        matched++;
        beep('ok');
        if (matched === pairs.size) setTimeout(() => finishExercise(errors === 0, ex), 350);
      } else {
        errors++;
        [l, r].forEach((x) => { x.classList.remove('sel'); x.classList.add('bad'); setTimeout(() => x.classList.remove('bad'), 400); });
        navigator.vibrate?.(30);
      }
      sel = null;
    }));
  }

  if (ex.t === 'station' || ex.t === 'levelSetup' || ex.t === 'stakeout') {
    const svg = $('#map');
    svg.addEventListener('pointerdown', (e) => {
      if (run.locked) return;
      const p = svgPoint(svg, e);
      const q = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
      $('#mk').innerHTML = ex.t === 'stakeout' ? prism(q.x, q.y, 'mine') : tripod(q.x, q.y, '', 'mine');
      beep('tick');
      setAnswer(q);
    });
  }

  if (ex.t === 'bubble') {
    let b = { ...ex.b0 };
    setBubble(b);
    const rot = [0, 0, 0];
    app.querySelectorAll('[data-screw]').forEach((btn) => btn.addEventListener('click', () => {
      if (run.locked) return;
      const i = +btn.dataset.screw, dir = +btn.dataset.dir;
      b = turnScrew(b, i, dir, ex.step);
      rot[i] += dir * 45;
      $(`#sc${i} .knurl`).setAttribute('transform', `rotate(${rot[i]})`);
      setBubble(b);
      beep('tick');
      setAnswer({ ...b });
    }));
  }

  if (ex.t === 'fieldbook') {
    const cells = [...app.querySelectorAll('[data-cell]')];
    const upd = () => setAnswer(cells.every((c) => c.value.trim()) ? cells.map((c) => c.value) : null);
    cells.forEach((c, i) => {
      c.addEventListener('input', upd);
      c.addEventListener('keydown', (e) => { if (e.key === 'Enter') (cells[i + 1] ?? checkBtn).focus(); });
    });
  }
}

function check() {
  if (run.locked || run.answer == null) return;
  const ex = run.items[run.i];
  if (isField(ex.t)) {
    const detail = checkField(ex, run.answer);
    run.locked = true;
    if (ex.t === 'fieldbook') {
      app.querySelectorAll('[data-cell]').forEach((c, i) => {
        c.disabled = true;
        c.classList.add(detail.cells[i] ? 'good' : 'bad');
        if (!detail.cells[i]) c.value = fmt(ex.a[i], 3);
      });
    } else drawFieldResult(ex, detail);
    app.querySelectorAll('[data-screw]').forEach((b) => { b.disabled = true; });
    return finishExercise(detail.ok, ex, detail.reason);
  }
  finishExercise(grade(ex, run.answer), ex);
}

const PRAISE = ['Výborně!', 'Přesně na milimetr!', 'Paráda!', 'Správně!', 'Jako z učebnice!', 'Sedí to!'];

function finishExercise(ok, ex, reason = '') {
  run.locked = true;
  store.recordAnswer(ex, ok);
  if (ok) { run.correct++; run.combo++; } else {
    run.mistakes++; run.combo = 0;
    if (!run.meta.practice) store.loseHeart();
    // Chybnou otázku zopakovat na konci (jednou); výpočty a terénní úlohy s novými čísly.
    if (!run.retried.has(run.i) && ex.t !== 'm') {
      run.retried.add(run.items.length);
      run.items.push(ex.gen ? prepare(generate(ex.gen)) : prepare(ex, ex.ref));
    }
  }
  beep(ok ? 'ok' : 'bad');
  if (ex.t === 'c' || ex.t === 'tf') {
    app.querySelectorAll('.opt').forEach((b) => {
      const v = ex.t === 'c' ? ex.options[+b.dataset.i] : b.dataset.v === '1';
      if (v === ex.a) b.classList.add('good'); else if (b.classList.contains('sel')) b.classList.add('bad');
      b.disabled = true;
    });
  }
  const fb = document.createElement('div');
  fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
  const answerText = !ok && ex.t !== 'm' && !isField(ex.t) ? correctText(ex, fmt) : '';
  fb.innerHTML = `<div>
    <div class="fb-head">${mascot(ok ? 'wow' : 'sad')}<h3>${ok ? PRAISE[Math.floor(Math.random() * PRAISE.length)] : isField(ex.t) ? 'Tohle v terénu neprojde' : 'Správná odpověď:'}</h3></div>
    ${answerText ? `<div class="ans">${esc(answerText)}</div>` : ''}
    ${reason && !ok ? `<div class="ans">${esc(reason)}</div>` : ''}
    ${ex.e ? `<div class="exp">${esc(ex.e)}</div>` : ''}
    <button class="btn ${ok ? 'primary' : 'red'} wide" id="next">Pokračovat</button></div>`;
  $('.check-bar')?.remove();
  app.append(fb);
  $('#next').focus({ preventScroll: true });
  $('#next').addEventListener('click', next);
}

function next() {
  if (!run.meta.practice && store.S().hearts <= 0) { run = null; return noHearts(); }
  run.i++;
  if (run.i >= run.items.length) return finishRun();
  renderExercise();
  window.scrollTo(0, 0);
}

function finishRun() {
  const r = run;
  const total = r.correct + r.mistakes;
  const result = store.completeLesson(r.meta.lessonId, { mistakes: r.mistakes, practice: r.meta.practice });
  if (r.meta.practice) store.gainHeart();
  run = null;
  beep('done');
  const acc = total ? Math.round((r.correct / total) * 100) : 100;
  const mins = Math.max(1, Math.round((Date.now() - r.started) / 60000));
  const s = store.S();
  const rk = store.rank(s.xp);
  app.innerHTML = `<div class="done-screen">
    <div class="stamp">${r.mistakes === 0 ? 'Bez chyby' : 'Zaměřeno'}</div>
    ${mascot('wow', 'big')}
    <h1>${r.meta.practice ? 'Procvičení hotovo!' : 'Lekce dokončena!'}</h1>
    <div class="cards">
      <div class="card" style="--c:#e0a800"><b>XP</b><span>+${result.xp}</span></div>
      <div class="card" style="--c:#16a37f"><b>Přesnost</b><span>${acc} %</span></div>
      <div class="card" style="--c:#2b8fd6"><b>Čas</b><span>${mins} min</span></div>
    </div>
    <div class="done-notes">
    ${result.streakUp ? `<p>🔥 <b>${s.streak} ${s.streak === 1 ? 'den' : s.streak < 5 ? 'dny' : 'dní'} v terénu v řadě!</b></p>` : ''}
    ${s.xpToday >= s.dailyGoal ? '<p>🎯 Denní cíl splněn!</p>' : `<p>Denní cíl: ${s.xpToday} / ${s.dailyGoal} XP</p>`}
    <p>Hodnost: <b>${rk.title}</b>${rk.next ? ` · do další ${rk.next.xp - s.xp} XP` : ''}</p>
    ${result.newAchievements.map((a) => `<p class="newach">${a.icon} Nový úspěch: <b>${esc(a.title)}</b></p>`).join('')}
    ${r.meta.practice ? '<p>🔋 Baterie +1 dílek za procvičování</p>' : ''}
    </div>
    <button class="btn primary wide" id="cont">Pokračovat</button>
  </div>`;
  confetti();
  $('#cont').addEventListener('click', () => show(r.meta.practice ? 'practice' : 'path'));
}

function noHearts() {
  const ms = store.nextHeartIn();
  app.innerHTML = `<div class="done-screen">${mascot('sad', 'big')}
    <h1 style="color:var(--red)">Vybitá baterie</h1>
    <p>Toti se musí dobít. Další dílek za ${Math.ceil(ms / 60000)} min – nebo si ho hned vysloužíš procvičováním v terénu.</p>
    <button class="btn blue wide" id="prac">Jít procvičovat</button>
    <button class="btn wide" id="home">Zpět na mapu</button></div>`;
  $('#prac').addEventListener('click', () => show('practice'));
  $('#home').addEventListener('click', () => show('path'));
}

function confetti() {
  const c = document.createElement('div');
  c.className = 'confetti';
  const colors = ['#16a37f', '#2b8fd6', '#f2c230', '#e5484d', '#8b5cf6', '#f08a24'];
  c.innerHTML = Array.from({ length: 60 }, () => `<i style="left:${Math.random() * 100}%;background:${colors[Math.floor(Math.random() * colors.length)]};animation-delay:${Math.random() * 0.6}s;animation-duration:${1.8 + Math.random() * 1.4}s"></i>`).join('');
  app.append(c); // zmizí s dalším překreslením obrazovky
  setTimeout(() => c.remove(), 3500);
}

// ---------------------------------------------------------------------------------------
// Lať s E-dělením pro odečítání

function drawRod(cv, reading) {
  const g = cv.getContext('2d'), S = cv.width, c = S / 2;
  const span = 0.2;                     // zobrazený rozsah latě (m)
  const ppm = S / span;                 // pixelů na metr
  const y = (v) => c - (v - reading) * ppm;
  const tilt = (Math.random() - 0.5) * 0.02;
  g.save();
  g.fillStyle = '#9fb7a0'; g.fillRect(0, 0, S, S);   // pozadí (tráva / křoví, rozmazané)
  for (let i = 0; i < 40; i++) { g.fillStyle = `rgba(${60 + Math.random() * 60},${110 + Math.random() * 60},${60 + Math.random() * 40},.35)`; g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 20 + Math.random() * 60, 0, 7); g.fill(); }
  g.translate(c, c); g.rotate(tilt); g.translate(-c, -c);
  const w = S * 0.36, x0 = c - w / 2;
  g.fillStyle = '#fbfbf6'; g.fillRect(x0, 0, w, S);
  g.fillStyle = '#c9ccd0'; g.fillRect(x0 - 10, 0, 10, S); g.fillRect(x0 + w, 0, 10, S);
  const lo = Math.floor((reading - span) * 100), hi = Math.ceil((reading + span) * 100);
  const half = w / 2;
  for (let k = lo; k < hi; k++) {
    if (k < 0) continue;
    const top = y((k + 1) / 100), h = y(k / 100) - top;
    g.fillStyle = Math.floor(k / 100) % 2 === 0 ? '#151515' : '#c8102e';
    const left = Math.floor(k / 5) % 2 === 0;
    const ex = left ? x0 + 6 : x0 + half;
    const ew = half - 12;
    // Páteř „E“ po celých 5 cm, ramena na 1., 3. a 5. centimetru.
    g.fillRect(left ? ex : ex + ew - 12, top, 12, h + 0.5);
    if ((k % 5) % 2 === 0) g.fillRect(ex, top, ew, h + 0.5);
  }
  g.font = `900 ${Math.round(ppm * 0.05)}px Helvetica, Arial, sans-serif`;
  g.textBaseline = 'alphabetic';
  for (let dm = Math.max(1, Math.floor(lo / 10)); dm <= Math.ceil(hi / 10); dm++) {
    const yy = y(dm / 10);
    if (yy < -80 || yy > S + 80) continue;
    const m = Math.floor(dm / 10);
    g.fillStyle = m % 2 === 0 ? '#151515' : '#c8102e';
    const text = `${m}${dm % 10}`;
    const left = Math.floor((dm * 10) / 5) % 2 === 0;   // čísla na straně bez „E“
    const tx = left ? x0 + half + 8 : x0 + 8;
    g.fillText(text, tx, yy - 2);
    g.fillRect(left ? x0 + w - 18 : x0 + 2, yy - 1.5, 16, 3);
    if (dm % 10 === 0) { g.fillStyle = '#c8102e'; g.beginPath(); g.arc(c, yy - 26, 9, 0, 7); g.fill(); }
  }
  g.restore();
  // Nitkový kříž a dálkoměrné rysky.
  g.strokeStyle = 'rgba(0,0,0,.85)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(0, c); g.lineTo(S, c); g.moveTo(c, 0); g.lineTo(c, S); g.stroke();
  g.lineWidth = 1.5;
  g.beginPath(); g.moveTo(c - 60, c - 150); g.lineTo(c + 60, c - 150); g.moveTo(c - 60, c + 150); g.lineTo(c + 60, c + 150); g.stroke();
  // Vinětace okuláru.
  const grad = g.createRadialGradient(c, c, S * 0.3, c, c, S * 0.5);
  grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,.55)');
  g.fillStyle = grad; g.fillRect(0, 0, S, S);
}

// ---------------------------------------------------------------------------------------
// Terén (procvičování)

const CALC_SETS = {
  coords: ['bearing', 'distance', 'polarY', 'polarX', 'areaTriangle', 'areaQuad'],
  angles: ['gonToDeg', 'degToGon', 'dmsToDeg', 'gonToRad', 'angleDiff'],
  level: ['levelDiff', 'levelHeight', 'levelClosure', 'levelLimit', 'horizonHeight', 'stadia'],
  vs: ['weightedMean', 'unitWeightError', 'curvRefraction', 'ellipsoidalHeight', 'normalHeight', 'photoScale', 'gsd', 'photoBase', 'sphericalExcess', 'radiusM', 'radiusN', 'baseline3d'],
};

function renderPractice() {
  const s = store.S();
  const doneIds = Object.keys(s.done);
  const card = (id, ic, title, desc, disabled = false) =>
    `<button class="tile-card" data-p="${id}" ${disabled ? 'disabled' : ''}><span class="ic">${ic}</span><span class="grow"><b>${title}</b><small>${desc}</small></span><span class="go">›</span></button>`;
  const fieldCard = (id, title, desc, art) =>
    `<button class="field-card" data-p="${id}">${art}<b>${title}</b><small>${desc}</small></button>`;
  app.innerHTML = topStats() + `<div class="page">
    <div class="page-head">${mascot()}<div><h2>Terénní praxe</h2><p class="hint">Procvičování nevybíjí baterii a za každé dokončení ti dílek dobije.</p></div></div>
    <div class="field-grid">
      ${fieldCard('f-station', 'Výběr stanoviska', 'Odkud zaměříš všechny body?', '<svg viewBox="0 0 60 40"><rect x="22" y="8" width="16" height="11" class="a1"/><circle cx="10" cy="30" r="3" class="a2"/><path d="M40 32 10 12M40 32 52 8M40 32 30 34" class="a3"/><path d="M40 32l-3 5M40 32l3 5" class="a4"/></svg>')}
      ${fieldCard('f-levelSetup', 'Nivelace ze středu', 'Stejně dlouhé záměry vzad i vpřed', '<svg viewBox="0 0 60 40"><rect x="6" y="10" width="3" height="20" class="a5"/><rect x="51" y="10" width="3" height="20" class="a5"/><path d="M9 20h42" class="a3"/><path d="M30 20l-3 10M30 20l3 10" class="a4"/></svg>')}
      ${fieldCard('f-stakeout', 'Vytyčení polárně', 'Úhel a délka → kde je bod?', '<svg viewBox="0 0 60 40"><path d="M14 30 44 10" class="a3"/><path d="M14 30 50 28" class="a6"/><circle cx="44" cy="10" r="3" class="a2"/><path d="M14 30l-3 6M14 30l3 6" class="a4"/></svg>')}
      ${fieldCard('f-bubble', 'Urovnání libely', 'Stavěcí šrouby a bublina', '<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="14" class="a7"/><circle cx="30" cy="20" r="5" class="a6"/><circle cx="35" cy="16" r="3.5" class="a8"/></svg>')}
      ${fieldCard('f-fieldbook', 'Nivelační zápisník', 'Dopočítej převýšení a výšku', '<svg viewBox="0 0 60 40"><rect x="12" y="5" width="36" height="30" rx="2" class="a9"/><path d="M16 13h28M16 19h28M16 25h28M28 7v26" class="a6"/></svg>')}
      ${fieldCard('f-rod', 'Čtení latě', 'Trénink oka na milimetry', '<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="16" class="a7"/><rect x="25" y="4" width="10" height="32" class="a9"/><path d="M14 20h32M30 4v32" class="a6"/></svg>')}
    </div>
    <button class="btn blue wide" data-p="f-all">Terénní směs · 6 úloh</button>
    <h3 class="sec">Výpočty</h3>
    ${card('calc', '🧮', 'Rychlé výpočty', 'Nekonečné příklady se stále novými čísly')}
    ${card('coords', '📍', 'Souřadnicové úlohy', 'Směrník, délka, polární metoda, výměry')}
    ${card('angles', '📐', 'Převody úhlů', 'gony, stupně, DMS, radiány')}
    ${card('level', '⚖️', 'Nivelace', 'Převýšení, výšky, uzávěry, mezní odchylky')}
    ${card('vs', '🎓', 'Vysokoškolské výpočty', 'Poloměry křivosti, exces, MNČ, výšky, fotogrammetrie')}
    <h3 class="sec">Opakování</h3>
    ${card('mistakes', '🔁', 'Opakovat chyby', s.mistakes.length ? `${s.mistakes.length} otázek, které ti nešly` : 'Zatím žádné chyby 🎉', !s.mistakes.length)}
    ${card('mix', '🎲', 'Mix z probraného', doneIds.length ? `Náhodné otázky z ${doneIds.length} dokončených lekcí` : 'Nejdřív dokonči nějakou lekci', !doneIds.length)}
  </div>` + tabs();
  app.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.p;
    if (p === 'mistakes') startPractice(buildMistakes(s.mistakes), 'Opakování chyb');
    else if (p === 'mix') startPractice(buildMix(doneIds), 'Mix');
    else if (p === 'calc') startPractice(buildCalcPractice(10), 'Výpočty');
    else if (p === 'f-rod') startPractice(buildCalcPractice(6, ['rod']), 'Lať');
    else if (p === 'f-all') startPractice(shuffle([...buildFieldPractice(5), prepare(generate('rod'))]), 'Terén');
    else if (p.startsWith('f-')) startPractice(buildFieldPractice(4, [p.slice(2)]), b.querySelector('b').textContent);
    else startPractice(buildCalcPractice(10, CALC_SETS[p]), b.querySelector('b').textContent);
  }));
}

// ---------------------------------------------------------------------------------------
// Profil

function renderProfile() {
  const s = store.S();
  const doneCount = Object.keys(s.done).length;
  const acc = s.stats.answered ? Math.round((s.stats.correct / s.stats.answered) * 100) : 0;
  const goalPct = Math.min(1, s.xpToday / s.dailyGoal);
  const rk = store.rank(s.xp);
  const rkPct = rk.next ? (s.xp - rk.xp) / (rk.next.xp - rk.xp) : 1;
  const ring = `<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" stroke-width="5"/>
    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--gold)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(goalPct * 94.2).toFixed(1)} 94.2" transform="rotate(-90 18 18)"/></svg>`;
  app.innerHTML = topStats() + `<div class="page">
    <div class="id-card">
      ${mascot()}
      <div class="grow"><small>Průkaz měřiče</small><h2>${rk.title}</h2>
        <div class="rankbar"><i style="width:${rkPct * 100}%"></i></div>
        <div class="hint">${rk.next ? `${s.xp} / ${rk.next.xp} XP do hodnosti ${rk.next.title}` : 'Nejvyšší hodnost – gratuluji!'}</div></div>
    </div>
    <div class="grid2">
      <div class="statbox">${ICON.flame}<b>${s.streak}</b><small>dní v terénu v řadě</small></div>
      <div class="statbox">${ICON.star}<b>${s.xp}</b><small>celkem XP</small></div>
      <div class="statbox"><span class="emo">📚</span><b>${doneCount} / ${LESSONS.length}</b><small>lekcí dokončeno</small></div>
      <div class="statbox"><span class="emo">🎯</span><b>${acc} %</b><small>přesnost odpovědí</small></div>
      <div class="statbox"><span class="emo">🦺</span><b>${s.stats.field}</b><small>terénních úloh</small></div>
      <div class="statbox"><span class="emo">🧮</span><b>${s.stats.calc}</b><small>správných výpočtů</small></div>
    </div>
    <div class="row goalrow">${ring}<div class="grow"><b>Denní cíl</b><div class="hint">Dnes ${s.xpToday} z ${s.dailyGoal} XP</div></div></div>
    <div class="goal">${[10, 20, 30, 50].map((g) => `<button class="btn ${s.dailyGoal === g ? 'blue' : ''}" data-goal="${g}">${g} XP</button>`).join('')}</div>
    <h3 class="sec">Úspěchy</h3>
    <div class="ach-grid">${store.ACHIEVEMENTS.map((a) => `<div class="ach ${s.achievements.includes(a.id) ? '' : 'locked'}"><span class="ic">${a.icon}</span><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></div>`).join('')}</div>
    <h3 class="sec">Nastavení</h3>
    <div class="seg"><span>Studuji</span><button data-track="ss" class="${s.track !== 'vs' ? 'on' : ''}">Střední školu</button><button data-track="vs" class="${s.track === 'vs' ? 'on' : ''}">Vysokou školu</button></div>
    <label class="toggle">Zvuky <input type="checkbox" id="snd" ${s.sound ? 'checked' : ''}></label>
    <label class="toggle">Odemknout všechny lekce <input type="checkbox" id="unl" ${s.unlockAll ? 'checked' : ''}></label>
    <p class="hint">Pokrok se ukládá jen v tomto zařízení.</p>
    <button class="btn red wide" id="reset">Smazat pokrok</button>
  </div>` + tabs();
  app.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => { s.dailyGoal = +b.dataset.goal; store.save(); renderProfile(); }));
  app.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => { s.track = b.dataset.track; store.save(); renderProfile(); }));
  $('#snd').addEventListener('change', (e) => { s.sound = e.target.checked; store.save(); });
  $('#unl').addEventListener('change', (e) => { s.unlockAll = e.target.checked; store.save(); });
  $('#reset').addEventListener('click', () => { if (confirm('Opravdu smazat veškerý pokrok?')) { store.reset(); toast('Pokrok smazán'); renderProfile(); } });
}

// ---------------------------------------------------------------------------------------
// Úvod a start

function welcome() {
  const nSS = UNITS.filter((u) => !isUni(u.level ?? 'SŠ')).length, nVS = UNITS.length - nSS;
  app.innerHTML = `<div class="done-screen welcome">
    ${mascot('happy', 'big')}
    <h1>Ahoj, já jsem Toti!</h1>
    <p>Totální stanice, která tě naučí geodézii – teorii, výpočty i práci v terénu. Pár minut denně stačí.</p>
    <p class="hint">${nSS} kapitol pro SŠ · ${nVS} vysokoškolských · ${LESSONS.length} lekcí · terénní úlohy</p>
    <div class="choose">
      <button class="choice" data-track="ss"><span>🏫</span><b>Střední škola</b><small>Začnu od základů</small></button>
      <button class="choice" data-track="vs"><span>🎓</span><b>Vysoká škola</b><small>Otevři i VŠ nadstavbu</small></button>
    </div>
  </div>`;
  app.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => {
    store.S().track = b.dataset.track; store.save();
    localStorage.setItem('geolingo.onboarded', '1');
    show('path');
  }));
}

store.tick();
if (localStorage.getItem('geolingo.onboarded')) show('path'); else welcome();
setInterval(() => { if (!run && !document.querySelector('.sheet-bg')) { const before = store.S().hearts; store.tick(); if (store.S().hearts !== before && tab !== 'profile') show(tab); } }, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
}

// Pro testy v prohlížeči.
window.__geolingo = { store, LESSONS, startLesson, startPractice, buildCalcPractice, buildFieldPractice, shuffle, current: () => run && run.items[run.i] };

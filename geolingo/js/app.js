// Geolingo – uživatelské rozhraní: mapa lekcí, cvičení, terénní praxe, profil.

import { UNITS, LESSONS, TIPS, EXAMS, buildExam, examGrade, lessonById, buildLesson, buildUnitTest, buildCalcPractice, buildFieldPractice, buildMistakes, buildMix, grade, correctText, prepare, shuffle } from './engine.js';
import { fmt, generate } from './generators.js';
import { W, H, checkField, solutionCells, turnScrew, SCREWS, FIELD_TYPES, pdop } from './field.js';
import * as store from './store.js';
import { backdrop } from './backdrop.js';

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const isField = (t) => FIELD_TYPES.includes(t);

// ---------------------------------------------------------------------------------------
// Maskot Toti (totální stanice na stativu) – přesně podle předlohy.

function mascot(mood = 'happy', cls = '', outfit = null) {
  // Oči na displeji: normální ovály, smutné = přivřené, překvapené = větší.
  const eh = mood === 'sad' ? 26 : mood === 'wow' ? 66 : 55;
  const ey = mood === 'sad' ? 482 : 480 - eh / 2;
  return `<svg class="toti ${cls}" viewBox="60 50 720 910" aria-hidden="true">
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
    ${outfitSvg(outfit)}
  </svg>`;
}

// ---------------------------------------------------------------------------------------
// Výbava pro Totiho – odemyká se hodnostmi (kosmetická odměna)

export const OUTFIT = [
  { id: 'reflex', slot: 'legs', name: 'Reflexní pásky', rank: 1, svg: '<line x1="236" y1="789" x2="208" y2="822" stroke="#f97316" stroke-width="36"/><line x1="226" y1="802" x2="219" y2="810" stroke="#f1f5f9" stroke-width="38"/><line x1="474" y1="789" x2="502" y2="822" stroke="#f97316" stroke-width="36"/><line x1="484" y1="802" x2="491" y2="810" stroke="#f1f5f9" stroke-width="38"/><line x1="355" y1="790" x2="355" y2="824" stroke="#f97316" stroke-width="36"/><line x1="355" y1="803" x2="355" y2="811" stroke="#f1f5f9" stroke-width="38"/>' },
  { id: 'cap', slot: 'head', name: 'Kšiltovka', rank: 1, svg: '<path d="M250 170 Q355 60 462 170Z" fill="#2b8fd6" stroke="#1f6fab" stroke-width="6"/><path d="M440 166 L560 176 Q540 150 470 150Z" fill="#1f6fab"/><circle cx="355" cy="104" r="10" fill="#1f6fab"/>' },
  { id: 'helmet', slot: 'head', name: 'Ochranná přilba', rank: 2, svg: '<path d="M228 176 Q228 70 357 66 Q486 70 486 176Z" fill="#f8fafc" stroke="#cbd5e1" stroke-width="6"/><rect x="210" y="166" width="294" height="22" rx="11" fill="#e2e8f0" stroke="#cbd5e1" stroke-width="4"/><path d="M357 70V172" stroke="#e2e8f0" stroke-width="16"/>' },
  { id: 'pole', slot: 'side', name: 'Výtyčka', rank: 2, svg: '<g><rect x="690" y="330" width="16" height="620" fill="#fff" stroke="#999" stroke-width="3"/><rect x="690" y="330" width="16" height="70" fill="#dc2626"/><rect x="690" y="470" width="16" height="70" fill="#dc2626"/><rect x="690" y="610" width="16" height="70" fill="#dc2626"/><rect x="690" y="750" width="16" height="70" fill="#dc2626"/><path d="M698 950 690 930h16Z" fill="#555"/></g>' },
  { id: 'glasses', slot: 'face', name: 'Sluneční brýle', rank: 3, svg: '<g fill="#0b1220" stroke="#334155" stroke-width="5"><rect x="270" y="446" width="80" height="58" rx="18"/><rect x="362" y="446" width="80" height="58" rx="18"/></g><path d="M350 470h12" stroke="#334155" stroke-width="6"/><path d="M285 458l30 0" stroke="#93c5fd" stroke-width="6" stroke-linecap="round" opacity=".7"/>' },
  { id: 'gnss', slot: 'head', name: 'GNSS anténa', rank: 4, svg: '<rect x="345" y="96" width="20" height="60" fill="#475569"/><ellipse cx="355" cy="96" rx="70" ry="16" fill="#e5e7eb" stroke="#94a3b8" stroke-width="5"/><ellipse cx="355" cy="90" rx="30" ry="8" fill="#94a3b8"/>' },
  { id: 'gold', slot: 'head', name: 'Zlatá přilba ÚOZI', rank: 5, svg: '<path d="M228 176 Q228 70 357 66 Q486 70 486 176Z" fill="#facc15" stroke="#ca8a04" stroke-width="6"/><rect x="210" y="166" width="294" height="22" rx="11" fill="#eab308" stroke="#ca8a04" stroke-width="4"/><path d="M357 70V172" stroke="#fde047" stroke-width="16"/><path d="M330 120l27-20 27 20-27 20z" fill="#fff" opacity=".7"/>' },
];

function outfitSvg(override = null) {
  const o = override ?? store.S().outfit ?? {};
  return ['side', 'legs', 'face', 'head'].map((slot) => OUTFIT.find((it) => it.slot === slot && o[slot] === it.id)?.svg ?? '').join('');
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
      <div class="chip" title="Dní v terénu v řadě${s.freezes ? ` · náhradní akumulátory: ${s.freezes}` : ''}">${ICON.flame}<b>${s.streak}</b>${s.freezes ? `<small class="frz">+${s.freezes}🔋</small>` : ''}</div>
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
const RUSTY_DAYS = 14;
/** Lekce, kterou je potřeba „oprášit“ – hotová, ale dlouho neopakovaná. */
const isRusty = (id) => isDone(id) && store.S().lastDone?.[id] && Date.now() - store.S().lastDone[id] > RUSTY_DAYS * 864e5;
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
      const cls = (done ? 'done' : !unlocked ? 'locked' : index === cur ? 'current' : 'open') + (isRusty(l.id) ? ' rusty' : '') + (l.id === justDone ? ' just' : '');
      const times = store.S().done[l.id] ?? 0;
      const hasField = (l.gens ?? []).some(isField);
      const p = pts[li];
      return `<div class="node-wrap" style="top:${p.y}px;left:calc(50% + ${p.x}px)">
          ${index === cur ? `<div class="toti-here" data-say="${u.id}" role="button" aria-label="Toti radí" style="${p.x > 0 ? 'right:128px' : 'left:128px'}">${mascot('happy')}<span class="start-tip">${done ? 'Opakovat' : 'Start'}</span></div>` : ''}
          <button class="node ${cls}" data-lesson="${l.id}" aria-label="${esc(l.title)}"><span class="ic">${unlocked ? l.icon : '🔒'}</span>
            ${times ? `<span class="times">${times > 1 ? '×' + Math.min(times, 9) : '✓'}</span>` : ''}${hasField ? '<span class="fieldmark" title="Obsahuje terénní úlohu">🦺</span>' : ''}${isRusty(l.id) ? '<span class="rustmark" title="Oprášit – dlouho neopakováno">🧹</span>' : ''}</button>
          <div class="node-label">${esc(l.title)}</div></div>`;
    }).join('');
    // Mapové značky podél cesty (stromy, trigonometrické body, nivelační značky, domy) – pevné pro danou kapitolu.
    let seed = ui * 7919 + 17;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const deco = pts.map((p, i) => {
      const side = p.x > 0 ? -1 : p.x < 0 ? 1 : (rnd() < 0.5 ? -1 : 1);
      const kind = ['tree', 'conifer', 'trig', 'bench', 'house', 'tree'][Math.floor(rnd() * 6)];
      return `<span class="deco ${kind}" style="top:${p.y + 10 + rnd() * 40}px;left:calc(50% + ${side * (120 + rnd() * 40)}px)"></span>`;
    }).join('');
    // Zkouška listu na konci kapitoly.
    const allDone = doneN === u.lessons.length, passed = !!store.S().unitTests?.[u.id];
    const ep = { x: 0, y: u.lessons.length * ROW + 44 };
    pts.push(ep);
    const examOpen = allDone || store.S().unlockAll;
    const exam = `<div class="node-wrap examwrap" style="top:${ep.y - 6}px;left:50%">
      <button class="node exam ${passed ? 'passed' : examOpen ? '' : 'locked'}" data-exam="${ui}" aria-label="Zkouška listu"><span class="ic">${passed ? '🏆' : examOpen ? '🏁' : '🔒'}</span></button>
      <div class="node-label">Zkouška listu${passed ? ' ✓' : ''}</div></div>`;
    // Spojnice bodů jako polygonový pořad: hotové úseky plnou čarou.
    const seg = pts.slice(1).map((p, i) => {
      const a = pts[i], solid = isDone(u.lessons[i].id);
      return `<line x1="${a.x}" y1="${a.y + 36}" x2="${p.x}" y2="${p.y + 36}" class="${solid ? 'solid' : ''}"/>`;
    }).join('');
    const firstIdx = LESSONS.findIndex((l) => l.unit === u);
    const fog = !store.S().unlockAll && firstIdx > cur + 10 && !u.lessons.some((l) => isDone(l.id));
    return `${divider}<section class="unit ${fog ? 'fog' : ''}" id="unit-${ui}" style="--c:${u.color}">
      <div class="sheet-head">
        <div class="sheet-meta"><span class="sheet-no">List ${String(ui + 1).padStart(2, '0')}</span><span class="lvl ${isUni(lvl) ? 'vs' : ''}">${lvl}</span>${u.course ? `<span class="sheet-course">${u.course !== '—' ? u.course + ' · ' : ''}${u.sem ?? ''}</span>` : ''}</div>
        <h2>${esc(u.title)}</h2><p>${esc(u.desc)}</p>${TIPS[u.id] ? `<button class="tips-btn" data-tips="${u.id}">📒 Tahák</button>` : ''}
        <div class="sheet-prog"><i style="width:${(doneN / u.lessons.length) * 100}%"></i></div><small>${doneN} / ${u.lessons.length} lekcí</small>
        <svg class="contours" viewBox="0 0 120 80" aria-hidden="true"><path d="M10 70c20-30 40-10 60-35s35-20 45-30M0 78c25-25 45-5 68-28s32-18 52-26M25 80c15-15 30-5 45-20s30-12 50-18"/></svg>
        <svg class="north" viewBox="0 0 20 30" aria-hidden="true"><path d="M10 2 16 22 10 18 4 22Z"/><text x="10" y="30">S</text></svg>
      </div>
      <div class="nodes" style="height:${(u.lessons.length + 1) * ROW + 30}px"><svg class="traverse" width="1" height="${(u.lessons.length + 1) * ROW}">${seg}</svg>${deco}${nodes}${exam}</div>
    </section>`;
  }).join('');
  app.innerHTML = topStats() + `<main class="path">${dailyCard()}${html}<div class="path-end">${mascot('wow')}<p>Konec mapy – jsi připraven do terénu!</p></div></main>
    <button class="index-btn" id="index" aria-label="Klad mapových listů">${ICON.map}<span>Listy</span></button>` + tabs();
  app.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => lessonSheet(b.dataset.lesson)));
  // Klepnutí na Totiho: tip z taháku aktuální kapitoly.
  app.querySelectorAll('[data-say]').forEach((t) => t.addEventListener('click', () => {
    const tips = TIPS[t.dataset.say];
    const pool = tips ? [...(tips.points ?? []), tips.tip].filter(Boolean) : ['Klepni na lekci vedle mě a jdeme měřit!'];
    t.querySelector('.say')?.remove();
    const b = document.createElement('div');
    b.className = 'say';
    b.textContent = pool[Math.floor(Math.random() * pool.length)];
    t.append(b); beep('tick');
    t.querySelector('.toti').classList.remove('hop'); void t.offsetWidth; t.querySelector('.toti').classList.add('hop');
    clearTimeout(t.sayTimer);
    t.sayTimer = setTimeout(() => b.remove(), 7000);
  }));
  $('#chest')?.addEventListener('click', () => {
    const xp = store.claimDaily();
    if (xp) { beep('done'); confetti(); toast(`Truhla otevřena: +${xp} XP`); setTimeout(() => show('path'), 900); }
  });
  $('#index').addEventListener('click', indexSheet);
  if (justDone) { const n = $('.node.just'); if (n) setTimeout(() => n.classList.remove('just'), 1600); justDone = null; }
  app.querySelectorAll('[data-tips]').forEach((b) => b.addEventListener('click', () => tipsSheet(b.dataset.tips)));
  app.querySelectorAll('[data-exam]').forEach((b) => b.addEventListener('click', () => {
    const u = UNITS[+b.dataset.exam];
    if (!u.lessons.every((l) => isDone(l.id)) && !store.S().unlockAll) return toast('Zkouška se odemkne po dokončení všech lekcí listu');
    scrollMemory = window.scrollY;
    begin(buildUnitTest(u), { lessonId: null, unitTest: u.id, unitId: u.id, title: `Zkouška: ${u.title}`, practice: false, color: u.color });
  }));
}

/** Úkoly dne s bonusovou truhlou. */
function dailyCard() {
  const qs = store.dailyQuests(), allDone = qs.every((q) => q.done), claimed = store.dailyClaimed();
  const chest = `<svg viewBox="0 0 40 34" class="chest ${allDone && !claimed ? 'ready' : ''}"><rect x="3" y="14" width="34" height="18" rx="3" class="cb"/><path d="M3 16c0-8 6-13 17-13s17 5 17 13z" class="${claimed ? 'co' : 'ct'}"/><rect x="17" y="13" width="6" height="8" rx="1.5" class="cl"/></svg>`;
  return `<section class="daily">
    <div class="daily-head"><b>Úkoly dne</b><small>${claimed ? 'Truhla otevřena ✓' : allDone ? 'Hotovo – otevři truhlu!' : `Bonus +${store.DAILY_BONUS} XP za všechny tři`}</small></div>
    <div class="daily-body"><div class="quests">${qs.map((q) => `<div class="quest ${q.done ? 'done' : ''}"><span class="qt">${q.done ? '✓ ' : ''}${esc(q.title)}</span>
      <div class="qbar"><i style="width:${(q.value / q.target) * 100}%"></i><em>${q.value} / ${q.target}</em></div></div>`).join('')}</div>
      <button class="chest-btn" id="chest" ${allDone && !claimed ? '' : 'disabled'} aria-label="Otevřít truhlu">${chest}</button></div>
  </section>`;
}

/** Klad mapových listů: rychlý skok na kapitolu. */
function indexSheet() {
  let last = null;
  const rows = UNITS.map((u, ui) => {
    const lvl = u.level ?? 'SŠ';
    const head = lvl !== last ? `<h4>${lvl === 'SŠ' ? 'Střední škola' : LEVELS[lvl]?.title ?? lvl}</h4>` : '';
    last = lvl;
    const doneN = u.lessons.filter((l) => isDone(l.id)).length;
    return `${head}<button class="idx" data-unit="${ui}" style="--c:${u.color}"><span class="no">${String(ui + 1).padStart(2, '0')}</span><span class="grow">${esc(u.title)}${u.course ? `<small>${u.course !== '—' ? u.course + ' · ' : ''}${u.sem ?? ''}</small>` : ''}</span><span class="pr">${doneN}/${u.lessons.length}</span></button>`;
  }).join('');
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet index-sheet" style="--c:var(--petrol)"><h3>Klad mapových listů</h3>
    <input class="idx-search" id="idxq" type="search" placeholder="Hledat kapitolu nebo kód předmětu…" autocomplete="off"><div class="idx-list">${rows}</div></div>`;
  document.body.append(bg);
  const norm = (t) => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  $('#idxq', bg).addEventListener('input', (e) => {
    const q = norm(e.target.value.trim());
    bg.querySelectorAll('.idx').forEach((b) => { b.hidden = q && !norm(b.textContent).includes(q); });
    bg.querySelectorAll('.idx-list h4').forEach((h) => { h.hidden = !!q; });
  });
  bg.addEventListener('click', (e) => {
    if (e.target === bg) return bg.remove();
    const b = e.target.closest('[data-unit]');
    if (b) { bg.remove(); document.getElementById(`unit-${b.dataset.unit}`).scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  });
}

/** Tahák ke kapitole: úvod, vzorce, klíčové body, pojmy a tip od Totiho. */
function tipsSheet(unitId) {
  const u = UNITS.find((x) => x.id === unitId), t = TIPS[unitId];
  if (!t) return;
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet tips-sheet" style="--c:${u.color}">
    <div class="tips-head"><small>Tahák${u.course && u.course !== '—' ? ' · ' + u.course : ''}</small><h3>${esc(u.title)}</h3><button class="x" id="tclose" aria-label="Zavřít">✕</button></div>
    <div class="tips-body">
      ${t.intro ? `<p class="tips-intro">${esc(t.intro)}</p>` : ''}
      ${t.formulas?.length ? `<h4>Vzorce</h4><div class="formulas">${t.formulas.map(([n, f]) => `<div class="formula"><small>${esc(n)}</small><code>${esc(f)}</code></div>`).join('')}</div>` : ''}
      ${t.points?.length ? `<h4>Co si zapamatovat</h4><ul class="tips-points">${t.points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>` : ''}
      ${t.terms?.length ? `<h4>Pojmy</h4><dl class="terms">${t.terms.map(([a, b]) => `<dt>${esc(a)}</dt><dd>${esc(b)}</dd>`).join('')}</dl>` : ''}
      ${t.tip ? `<div class="toti-tip">${mascot()}<p><b>Toti radí:</b> ${esc(t.tip)}</p></div>` : ''}
    </div></div>`;
  document.body.append(bg);
  bg.addEventListener('click', (e) => { if (e.target === bg || e.target.closest('#tclose')) bg.remove(); });
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
    ${l.lessonIndex === 0 && TIPS[l.unit.id]?.intro ? `<div class="intro-card">${mascot()}<p><b>Kapitola v kostce:</b> ${esc(TIPS[l.unit.id].intro)}</p></div>` : ''}
    ${TIPS[l.unit.id] ? `<button class="linkbtn" id="tipsLink">📒 Tahák ke kapitole</button>` : ''}
    ${times ? `<p class="hint">Dokončeno ${times}× ${store.S().perfect[id] ? '· bez chyby 💯' : ''}</p>` : ''}
    ${unlocked ? `<button class="btn primary wide" id="go">${times ? 'Opakovat lekci · +10 XP' : 'Začít lekci · +10 XP'}</button>`
      : '<button class="btn wide" disabled>🔒 Nejdřív dokonči předchozí lekci</button>'}
  </div>`;
  document.body.append(bg);
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
  $('#go', bg)?.addEventListener('click', () => { bg.remove(); scrollMemory = window.scrollY; startLesson(id); });
  $('#tipsLink', bg)?.addEventListener('click', () => { bg.remove(); tipsSheet(l.unit.id); });
}

// ---------------------------------------------------------------------------------------
// Běh lekce

let run = null;

function startLesson(id) {
  store.tick();
  if (store.S().hearts <= 0) return noHearts();
  const l = lessonById(id);
  begin(buildLesson(l), { lessonId: id, unitId: l.unit.id, title: l.title, practice: false, color: l.unit.color });
}

function startPractice(items, title, refresh = null) {
  if (!items.length) { toast('Zatím tu nic není'); return; }
  begin(items, { lessonId: null, title, practice: true, color: '#2b8fd6', refresh });
}

function begin(items, meta) {
  run = { items, i: 0, mistakes: 0, correct: 0, retried: new Set(), meta, answer: null, locked: false, started: Date.now(), combo: 0 };
  renderExercise();
}

const KIND = {
  c: 'Vyber správnou odpověď', tf: 'Pravda, nebo ne?', m: 'Spoj dvojice', o: 'Seřaď kroky', n: 'Vypočítej', rod: 'Odečti lať',
  station: 'Terén · výběr stanoviska', levelSetup: 'Terén · nivelace ze středu', stakeout: 'Terén · vytyčení', bubble: 'Terén · urovnání libely', fieldbook: 'Terén · zápisník', dirbook: 'Terén · směrová osnova', traverse: 'Terén · polygonový pořad', blunder: 'Terén · kontrola zápisníku', azimuth: 'Směrník · kvadranty', circle: 'Odečti kruh v mikroskopu', contour: 'Terén · vrstevnice', sky: 'GNSS · geometrie družic',
};

function renderExercise() {
  const ex = run.items[run.i];
  run.answer = null; run.locked = false;
  const pct = Math.round((run.i / run.items.length) * 100);
  app.innerHTML = `<div class="lesson" style="--c:${run.meta.color}">
    <div class="lesson-top"><button class="x" id="quit" aria-label="Ukončit">✕</button>
      <div class="bar"><i style="width:${pct}%"></i>${run.combo >= 3 ? `<em>${run.combo}× v řadě</em>` : ''}</div>
      ${run.meta.unitId && TIPS[run.meta.unitId] ? '<button class="chip small tipchip" id="ltips" aria-label="Tahák">📒</button>' : ''}
      ${run.meta.exam ? `<span class="chip small timer" id="timer">⏱ ${fmtTime(run.meta.deadline - Date.now())}</span>` : run.meta.practice ? '<span class="chip small">🎯</span>' : `<span class="chip small">${battery(store.S().hearts)}</span>`}</div>
    <div class="ex ${isField(ex.t) ? 'field' : ''}"><div class="kind ${isField(ex.t) ? 'terrain' : ''}">${KIND[ex.t]}</div>${exerciseBody(ex)}</div>
    ${ex.t === 'm' ? '' : '<div class="check-bar"><div><button class="btn primary wide" id="check" disabled>Zkontrolovat</button></div></div>'}
  </div>`;
  $('#quit').addEventListener('click', () => { if (confirm('Opravdu ukončit? Pokrok v lekci se neuloží.')) { run = null; show(tab); } });
  $('#check')?.addEventListener('click', check);
  $('#ltips')?.addEventListener('click', () => tipsSheet(run.meta.unitId));
  wireExercise(ex);
}

function exerciseBody(ex) {
  switch (ex.t) {
    case 'c':
      return `<div class="mascot-row">${mascot()}<div class="bubble">${esc(ex.q)}</div></div>
        ${ex.img ? `<div class="symbol">${ex.img}</div>` : ''}
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
    case 'contour':
      return `<p class="prompt">Kudy prochází vrstevnice ${ex.L} m na hraně ${ex.pts[0].n}–${ex.pts[1].n}?</p>
        <div class="hint">Výšky bodů jsou v metrech, terén mezi body je rovinný (TIN). Klepni na místo průsečíku.</div>${mapSvg(ex)}`;
    case 'sky':
      return `<p class="prompt">Vyber 4 družice, které dají nejlepší geometrii (nejnižší PDOP).</p>
        ${skySvg(ex)}<div class="dial-read" id="skyRead">Vybráno 0 / 4</div>
        <div class="hint">Střed = zenit, kružnice = elevace 60°, 30° a obzor. Sever nahoře.</div>`;
    case 'circle':
      return `<p class="prompt">Jaké je čtení ${ex.label === 'V' ? 'svislého kruhu (zenitový úhel)' : 'vodorovného kruhu'} ve stupnicovém mikroskopu?</p>
        <canvas class="scope" id="circleCanvas" width="640" height="300"></canvas>
        <div class="numrow"><input class="num" id="num" inputmode="decimal" autocomplete="off" placeholder="např. 123,457"><span class="unit-label">gon</span></div>
        <div class="hint">Číslo ryšky = celé gony, stupnice 0–10 = desetiny gonu (100 dílků po 0,01 gon), tisíciny odhadni.</div>`;
    case 'azimuth':
      return `<p class="prompt">Natoč ručičku do směru σ bodu B z bodu A.</p>
        <div class="given"><span>ΔY = <b>${fmt(ex.dy, 2)} m</b></span><span>ΔX = <b>${fmt(ex.dx, 2)} m</b></span></div>
        ${dialSvg()}<div class="dial-read" id="dialRead">Táhni ručičkou nebo klepni na kružítko</div>
        <div class="hint">Směrník se měří od +X (sever, nahoře) po směru hodinových ručiček, 400 gon dokola. Tolerance ±${ex.tolG} gon.</div>`;
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
    case 'blunder':
      return `<p class="prompt">Kolega vyplnil nivelační zápisník. Na kterém stanovisku udělal hrubou chybu?</p>
        <div class="book"><table class="pick"><thead><tr><th>Stan.</th><th>Vzad</th><th>Vpřed</th><th>Δh</th><th>H [m]</th></tr></thead><tbody>
        <tr class="start"><td>Z</td><td></td><td></td><td></td><td>${fmt(ex.HZ, 3)}</td></tr>
        ${ex.rows.map((r, i) => `<tr data-row="${i}"><td>${i + 1}</td><td>${fmt(r.z, 3)}</td><td>${fmt(r.p, 3)}</td><td>${fmt(r.shown, 3)}</td><td>${fmt(r.H, 3)}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="hint">Klepni na řádek s chybou. Tip: přepočítej Δh = vzad − vpřed.</div>`;
    case 'traverse':
      return `<p class="prompt">Uzavřený polygonový pořad: vypočti úhlový uzávěr, opravu a opravené vnitřní úhly.</p>
        <div class="book"><table><thead><tr><th>Vrchol</th><th>Měřený ω [gon]</th><th>Opravený ω</th></tr></thead><tbody>
        ${ex.meas.map((m, i) => `<tr><td>${i + 1}</td><td>${fmt(m, 4)}</td><td><input class="cell" data-cell="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join('')}
        </tbody><tfoot>
        <tr><td colspan="2">Σω = ${fmt(ex.meas.reduce((a, b) => a + b, 0), 4)} · teorie ${(ex.n - 2) * 200} gon → uzávěr u [cc] =</td><td><input class="cell" data-cell="${ex.n}" inputmode="decimal" autocomplete="off"></td></tr>
        <tr><td colspan="2">Oprava na každý úhel v [cc] =</td><td><input class="cell" data-cell="${ex.n + 1}" inputmode="decimal" autocomplete="off"></td></tr>
        </tfoot></table></div>
        <div class="hint">1 cc = 0,0001 gon. Uzávěr se rozděluje rovnoměrně s opačným znaménkem.</div>`;
    case 'dirbook':
      return `<p class="prompt">Dopočítej směrovou osnovu měřenou ve dvou polohách dalekohledu.</p>
        <div class="book"><table><thead><tr><th>Cíl</th><th>I. poloha</th><th>II. poloha</th><th>Průměr [gon]</th></tr></thead><tbody>
        ${ex.rows.map((r, i) => `<tr><td>${r.n}</td><td>${fmt(r.I, 4)}</td><td>${fmt(r.II, 4)}</td><td><input class="cell" data-cell="${i}" inputmode="decimal" autocomplete="off"></td></tr>`).join('')}
        </tbody><tfoot><tr><td colspan="3">Úhel ω mezi cíli 1 → 3 =</td><td><input class="cell" data-cell="${ex.rows.length}" inputmode="decimal" autocomplete="off"></td></tr></tfoot></table></div>
        <div class="hint">Na 4 desetinná místa (0,1 mgon = 1 cc). Průměr vztáhni k I. poloze.</div>`;
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
  if (ex.t === 'contour') {
    const [A, B, C] = ex.pts;
    items = `<path class="tin" d="M${A.x} ${A.y}L${B.x} ${B.y}L${C.x} ${C.y}Z"/><line class="tin-edge" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/>`
      + ex.pts.map((q) => `<g class="spot"><circle cx="${q.x}" cy="${q.y}" r="1.1"/><text x="${q.x + 1.8}" y="${q.y - 1.6}">${q.n} ${q.h.toFixed(1).replace('.', ',')}</text></g>`).join('');
  }
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

// --- Sky plot pro výběr družic ----------------------------------------------------------

function skySvg(ex) {
  const pos = (s) => { const r = 92 * (1 - s.el / 90), a = s.az * Math.PI / 180; return [r * Math.sin(a), -r * Math.cos(a)]; };
  const sats = ex.sats.map((s, i) => { const [x, y] = pos(s); return `<g class="sat" data-sat="${i}" transform="translate(${x.toFixed(1)} ${y.toFixed(1)})"><circle r="11"/><text y="4">${s.prn.slice(1)}</text></g>`; }).join('');
  return `<svg class="skyplot" viewBox="-112 -112 224 224">
    <circle r="92" class="ring0"/><circle r="61.3" class="ring"/><circle r="30.7" class="ring"/>
    <path d="M0 -92V92M-92 0H92" class="ring"/><text y="-98" class="cardinal">S</text><text x="100" y="4" class="cardinal">V</text><text y="106" class="cardinal">J</text><text x="-100" y="4" class="cardinal">Z</text>
    <text x="3" y="-63" class="elv">30°</text><text x="3" y="-32" class="elv">60°</text>${sats}</svg>`;
}

// --- Kružítko pro směrník ----------------------------------------------------------------

function dialSvg() {
  const ticks = [];
  for (let g = 0; g < 400; g += 10) {
    const a = g * Math.PI / 200, big = g % 50 === 0, r1 = big ? 78 : 84;
    ticks.push(`<line x1="${(Math.sin(a) * r1).toFixed(1)}" y1="${(-Math.cos(a) * r1).toFixed(1)}" x2="${(Math.sin(a) * 92).toFixed(1)}" y2="${(-Math.cos(a) * 92).toFixed(1)}" class="${big ? 'big' : ''}"/>`);
    if (g % 100 === 0) ticks.push(`<text x="${(Math.sin(a) * 66).toFixed(1)}" y="${(-Math.cos(a) * 66 + 4).toFixed(1)}">${g}</text>`);
  }
  const quads = [['I', 45, -45], ['II', 45, 45], ['III', -45, 45], ['IV', -45, -45]].map(([t, x, y]) => `<text x="${x}" y="${y + 5}" class="quad">${t}</text>`).join('');
  return `<svg class="dial" id="dial" viewBox="-110 -110 220 220">
    <circle r="100" class="face"/><circle r="92" class="rim"/>
    <line x1="0" y1="-100" x2="0" y2="100" class="axis"/><line x1="-100" y1="0" x2="100" y2="0" class="axis"/>
    <text x="0" y="-102" class="ax">+X</text><text x="104" y="4" class="ax">+Y</text>
    ${ticks.join('')}${quads}
    <g id="needleOk" class="needle ok hidden"><path d="M0 -84 5 -10 0 -16 -5 -10Z"/></g>
    <g id="needle" class="needle" transform="rotate(0)"><path d="M0 -84 6 -8 0 -14 -6 -8Z"/><circle r="6"/></g>
  </svg>`;
}

// --- Stupnicový mikroskop (vodorovný kruh) ------------------------------------------------

function drawCircle(cv, reading, label = 'Hz') {
  const g = cv.getContext('2d'), Wc = cv.width, Hc = cv.height;
  g.fillStyle = '#1b2227'; g.fillRect(0, 0, Wc, Hc);
  const grad = g.createLinearGradient(0, 40, 0, Hc - 40);
  grad.addColorStop(0, '#f6ecc9'); grad.addColorStop(1, '#e8d9a6');
  g.fillStyle = grad; g.beginPath(); g.roundRect(30, 40, Wc - 60, Hc - 80, 18); g.fill();
  g.fillStyle = '#5a4a1c'; g.font = '700 26px Lexend, sans-serif'; g.fillText(label, 48, 80);
  const x0 = 110, x1 = Wc - 90, yScale = 170;
  // Stupnice 0–10 (100 dílků po 0,01 gon).
  g.strokeStyle = '#2b2410'; g.fillStyle = '#2b2410';
  for (let k = 0; k <= 100; k++) {
    const x = x0 + (x1 - x0) * k / 100, h = k % 10 === 0 ? 30 : k % 5 === 0 ? 22 : 14;
    g.lineWidth = k % 10 === 0 ? 2.2 : 1.4;
    g.beginPath(); g.moveTo(x, yScale); g.lineTo(x, yScale + h); g.stroke();
    if (k % 10 === 0) { g.font = '600 20px Lexend, sans-serif'; g.textAlign = 'center'; g.fillText(String(k / 10), x, yScale + 54); }
  }
  // Ryšky vodorovného kruhu: po 1 gon, délka intervalu = délka stupnice.
  const base = Math.floor(reading), frac = reading - base;
  for (const d of [-1, 0, 1]) {
    const x = x0 + (frac - d) * (x1 - x0);
    if (x < 40 || x > Wc - 40) continue;
    g.lineWidth = 3.2; g.strokeStyle = '#111';
    g.beginPath(); g.moveTo(x, 96); g.lineTo(x, yScale + 10); g.stroke();
    g.font = '700 28px Lexend, sans-serif'; g.textAlign = 'center'; g.fillStyle = '#111';
    g.fillText(String((base + d + 400) % 400), x, 90);
  }
  g.textAlign = 'left';
  // Vinětace a lehké rozostření okrajů jako v okuláru.
  const v = g.createRadialGradient(Wc / 2, Hc / 2, Hc * 0.3, Wc / 2, Hc / 2, Wc * 0.62);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.5)');
  g.fillStyle = v; g.fillRect(0, 0, Wc, Hc);
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

  if (ex.t === 'n' || ex.t === 'rod' || ex.t === 'circle') {
    const input = $('#num');
    input.addEventListener('input', () => setAnswer(input.value.trim()));
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !checkBtn.disabled) check(); });
    if (ex.t === 'rod') drawRod($('#rodCanvas'), ex.a);
    if (ex.t === 'circle') drawCircle($('#circleCanvas'), ex.a, ex.label ?? 'Hz');
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

  if (ex.t === 'blunder') {
    app.querySelectorAll('[data-row]').forEach((tr) => tr.addEventListener('click', () => {
      if (run.locked) return;
      app.querySelectorAll('[data-row]').forEach((x) => x.classList.remove('sel'));
      tr.classList.add('sel'); beep('tick');
      setAnswer(+tr.dataset.row);
    }));
  }

  if (ex.t === 'sky') {
    const sel = [];
    app.querySelectorAll('[data-sat]').forEach((g) => g.addEventListener('click', () => {
      if (run.locked) return;
      const i = +g.dataset.sat, k = sel.indexOf(i);
      if (k >= 0) sel.splice(k, 1); else if (sel.length < 4) sel.push(i); else return toast('Už máš 4 družice – nejdřív jednu odeber');
      g.classList.toggle('on', sel.includes(i));
      $('#skyRead').innerHTML = `Vybráno <b>${sel.length} / 4</b>`;
      beep('tick');
      setAnswer(sel.length === 4 ? sel.slice() : null);
    }));
  }

  if (ex.t === 'azimuth') {
    const svg = $('#dial');
    let dragging = false;
    const setFrom = (e) => {
      const p = svgPoint(svg, e);
      let g = Math.atan2(p.x, -p.y) * 200 / Math.PI; if (g < 0) g += 400;
      g = Math.round(g);
      $('#needle').setAttribute('transform', `rotate(${g * 0.9})`);
      $('#dialRead').innerHTML = `σ = <b>${g} gon</b>`;
      setAnswer(g);
    };
    svg.addEventListener('pointerdown', (e) => { if (run.locked) return; dragging = true; svg.setPointerCapture(e.pointerId); setFrom(e); beep('tick'); });
    svg.addEventListener('pointermove', (e) => { if (dragging && !run.locked) setFrom(e); });
    svg.addEventListener('pointerup', () => { dragging = false; });
  }

  if (ex.t === 'station' || ex.t === 'levelSetup' || ex.t === 'stakeout' || ex.t === 'contour') {
    const svg = $('#map');
    svg.addEventListener('pointerdown', (e) => {
      if (run.locked) return;
      const p = svgPoint(svg, e);
      const q = { x: Math.round(p.x * 10) / 10, y: Math.round(p.y * 10) / 10 };
      $('#mk').innerHTML = ex.t === 'stakeout' ? prism(q.x, q.y, 'mine') : ex.t === 'contour' ? `<circle class="cpick" cx="${q.x}" cy="${q.y}" r="1.3"/>` : tripod(q.x, q.y, '', 'mine');
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

  if (ex.t === 'fieldbook' || ex.t === 'dirbook' || ex.t === 'traverse') {
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
    if (ex.t === 'fieldbook' || ex.t === 'dirbook' || ex.t === 'traverse') {
      app.querySelectorAll('[data-cell]').forEach((c, i) => {
        c.disabled = true;
        c.classList.add(detail.cells[i] ? 'good' : 'bad');
        if (!detail.cells[i]) c.value = fmt(ex.a[i], ex.t === 'dirbook' || (ex.t === 'traverse' && i < ex.n) ? 4 : ex.t === 'traverse' ? 0 : 3);
      });
    } else if (ex.t === 'blunder') {
      $(`[data-row="${ex.a}"]`).classList.add('good');
      if (!detail.ok) $(`[data-row="${run.answer}"]`).classList.add('bad');
    } else if (ex.t === 'contour') {
      const p = run.answer, Q = ex.Q, O = ex.other;
      $('#ov').innerHTML = (O ? `<line class="cline" x1="${Q.x}" y1="${Q.y}" x2="${O.x}" y2="${O.y}"/>` : '') + `<circle class="tol" cx="${Q.x}" cy="${Q.y}" r="${ex.tolM}"/>`;
      $('#mk').innerHTML = `<circle class="cpick ${detail.ok ? 'good' : 'bad'}" cx="${p.x}" cy="${p.y}" r="1.3"/><circle class="cpick good" cx="${Q.x}" cy="${Q.y}" r="1.1"/><text class="plabel" x="${Q.x + 2}" y="${Q.y + 4}">${ex.L}</text>`;
    } else if (ex.t === 'sky') {
      ex.bestSet.forEach((i) => $(`[data-sat="${i}"]`).classList.add('best'));
      $('#skyRead').innerHTML = `Tvé PDOP <b>${detail.pdop.toFixed(1).replace('.', ',')}</b> · nejlepší ${ex.best.toFixed(1).replace('.', ',')}`;
    } else if (ex.t === 'azimuth') {
      $('#needleOk').setAttribute('transform', `rotate(${ex.a * 0.9})`);
      $('#needleOk').classList.remove('hidden');
      $('#needle').classList.add(detail.ok ? 'good' : 'bad');
    } else drawFieldResult(ex, detail);
    app.querySelectorAll('[data-screw]').forEach((b) => { b.disabled = true; });
    return finishExercise(detail.ok, ex, detail.reason);
  }
  finishExercise(grade(ex, run.answer), ex);
}

const PRAISE = ['Výborně!', 'Přesně na milimetr!', 'Paráda!', 'Správně!', 'Jako z učebnice!', 'Sedí to!'];

function finishExercise(ok, ex, reason = '') {
  run.locked = true;
  store.recordAnswer(ex, ok, run.meta.unitId ?? (ex.ref ? lessonById(ex.ref.lesson)?.unit.id : null));
  if (ok) { run.correct++; run.combo++; } else {
    run.mistakes++; run.combo = 0;
    if (!run.meta.practice) store.loseHeart();
    // Chybnou otázku zopakovat na konci (jednou); výpočty a terénní úlohy s novými čísly.
    if (!run.meta.exam && !run.retried.has(run.i) && ex.t !== 'm') {
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

// --- Zkouškový test s časovým limitem -------------------------------------------------------

const fmtTime = (ms) => { const t = Math.max(0, Math.ceil(ms / 1000)); return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
let examTimer = null;

function startExam(level) {
  const cfg = EXAMS[level];
  clearInterval(examTimer);
  begin(buildExam(level), { lessonId: null, title: cfg.title, practice: true, exam: level, color: '#0f4c5c', deadline: Date.now() + cfg.minutes * 60000 });
  examTimer = setInterval(() => {
    if (!run?.meta.exam) return clearInterval(examTimer);
    const left = run.meta.deadline - Date.now(), el = $('#timer');
    if (el) { el.textContent = `⏱ ${fmtTime(left)}`; el.classList.toggle('low', left < 60000); }
    if (left <= 0) { clearInterval(examTimer); toast('Čas vypršel'); finishExam(true); }
  }, 500);
}

function finishExam(timeout = false) {
  clearInterval(examTimer);
  const r = run, level = r.meta.exam, cfg = EXAMS[level];
  const total = r.items.length, pct = Math.round((r.correct / total) * 100), gradeL = examGrade(pct);
  const best = store.saveExam(level, pct, gradeL);
  const bonus = pct >= 50 ? 20 : 0;
  store.completeLesson(null, { mistakes: r.mistakes, practice: true });
  if (bonus) store.addXp(bonus);
  run = null;
  beep(pct >= 50 ? 'done' : 'bad');
  const mins = Math.max(1, Math.round((Date.now() - r.started) / 60000));
  app.innerHTML = `<div class="done-screen exam-result">
    ${mascot(pct >= 50 ? 'wow' : 'sad', 'big')}
    <h1>${esc(cfg.title)}</h1>
    <div class="grade g${gradeL}">${gradeL}</div>
    <p><b>${r.correct} / ${total}</b> správně (${pct} %) · ${timeout ? 'čas vypršel' : `${mins} min`}</p>
    <p>${pct >= 50 ? `Prošel jsi! +${bonus + 5} XP` : 'Tentokrát to nevyšlo – na zkoušku potřebuješ aspoň 50 %.'}</p>
    <p class="hint">Nejlepší výsledek: ${best.grade} (${best.pct} %) · stupnice ECTS jako na VUT</p>
    <button class="btn primary wide" id="cont">Zpět do terénu</button>
  </div>`;
  if (pct >= 50) confetti();
  $('#cont').addEventListener('click', () => show('practice'));
}

let justDone = null;

function finishRun() {
  if (run.meta.exam) return finishExam();
  const r = run;
  justDone = r.meta.lessonId;
  const total = r.correct + r.mistakes;
  const result = store.completeLesson(r.meta.lessonId, { mistakes: r.mistakes, practice: r.meta.practice, unitTest: r.meta.unitTest });
  if (r.meta.practice) store.gainHeart();
  if (r.meta.refresh) store.refreshLessons(r.meta.refresh);
  run = null;
  beep('done');
  const acc = total ? Math.round((r.correct / total) * 100) : 100;
  const mins = Math.max(1, Math.round((Date.now() - r.started) / 60000));
  const s = store.S();
  const rk = store.rank(s.xp), rkBefore = store.rank(s.xp - result.xp);
  const promoted = rk.index > rkBefore.index;
  app.innerHTML = `<div class="done-screen">
    <div class="stamp">${r.mistakes === 0 ? 'Bez chyby' : 'Zaměřeno'}</div>
    ${mascot('wow', 'big')}
    <h1>${r.meta.practice ? 'Procvičení hotovo!' : r.meta.unitTest ? 'Zkouška listu složena!' : 'Lekce dokončena!'}</h1>
    <div class="cards">
      <div class="card" style="--c:#e0a800"><b>XP</b><span data-count="${result.xp}" data-pre="+">+0</span></div>
      <div class="card" style="--c:#16a37f"><b>Přesnost</b><span data-count="${acc}" data-post=" %">0 %</span></div>
      <div class="card" style="--c:#2b8fd6"><b>Čas</b><span>${mins} min</span></div>
    </div>
    <div class="done-notes">
    ${promoted ? `<div class="promo"><span>🎖️</span><div><small>Povýšení!</small><b>${rk.title}</b>${OUTFIT.some((it) => it.rank === rk.index) ? `<small class="gearnew">Nová výbava pro Totiho: ${OUTFIT.filter((it) => it.rank === rk.index).map((it) => it.name).join(', ')}</small>` : ''}</div></div>` : ''}
    ${s.freezeEarned ? (() => { s.freezeEarned = false; store.save(); return '<p class="newach">🔋 Za 7 dní v řadě máš náhradní akumulátor – zachrání sérii, když jeden den vynecháš.</p>'; })() : ''}
    ${result.streakUp ? `<div class="streak-up"><span class="flame">${ICON.flame}</span><b>${s.streak} ${s.streak === 1 ? 'den' : s.streak < 5 ? 'dny' : 'dní'} v terénu v řadě!</b></div>` : ''}
    ${s.xpToday >= s.dailyGoal ? '<p>🎯 Denní cíl splněn!</p>' : `<p>Denní cíl: ${s.xpToday} / ${s.dailyGoal} XP</p>`}
    <p>Hodnost: <b>${rk.title}</b>${rk.next ? ` · do další ${rk.next.xp - s.xp} XP` : ''}</p>
    ${result.newAchievements.map((a) => `<p class="newach">${a.icon} Nový úspěch: <b>${esc(a.title)}</b></p>`).join('')}
    ${r.meta.practice ? '<p>🔋 Baterie +1 dílek za procvičování</p>' : ''}
    </div>
    <button class="btn primary wide" id="cont">Pokračovat</button>
  </div>`;
  confetti();
  // Čísla „naběhnou“ jako na displeji přístroje.
  app.querySelectorAll('[data-count]').forEach((el) => {
    const to = +el.dataset.count, t0 = performance.now();
    const tickNum = (t) => {
      const k = Math.min(1, (t - t0) / 900), v = Math.round(to * (1 - (1 - k) ** 3));
      el.textContent = `${el.dataset.pre ?? ''}${v}${el.dataset.post ?? ''}`;
      if (k < 1) requestAnimationFrame(tickNum);
    };
    requestAnimationFrame(tickNum);
  });
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
  const rusty = doneIds.filter(isRusty);
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
      ${fieldCard('f-azimuth', 'Směrník a kvadranty', 'Natoč ručičku podle ΔY a ΔX', '<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="16" class="a7"/><path d="M30 20 40 9" class="a3"/><path d="M30 4v32M14 20h32" class="a6"/></svg>')}
      ${fieldCard('f-circle', 'Čtení kruhu', 'Vodorovný i svislý kruh v mikroskopu', '<svg viewBox="0 0 60 40"><rect x="6" y="8" width="48" height="24" rx="5" class="a9"/><path d="M12 24h36M18 20v4M24 21v3M30 20v4M36 21v3M42 20v4" class="a6"/><path d="M27 11v13" class="a3"/></svg>')}
      ${fieldCard('f-dirbook', 'Směrová osnova', 'Dvě polohy dalekohledu, průměry a úhel', '<svg viewBox="0 0 60 40"><rect x="10" y="5" width="40" height="30" rx="2" class="a9"/><path d="M14 13h32M14 19h32M14 25h32M24 7v26M36 7v26" class="a6"/></svg>')}
      ${fieldCard('f-blunder', 'Najdi chybu', 'Kde se v zápisníku stala hrubá chyba?', '<svg viewBox="0 0 60 40"><rect x="10" y="5" width="40" height="30" rx="2" class="a9"/><path d="M14 13h32M14 25h32M24 7v26" class="a6"/><rect x="12" y="15" width="36" height="8" rx="2" fill="rgba(229,72,77,.35)"/></svg>')}
      ${fieldCard('f-traverse', 'Polygonový pořad', 'Úhlový uzávěr a opravené úhly', '<svg viewBox="0 0 60 40"><path d="M10 30 22 8 48 10 52 32Z" class="a3"/><circle cx="10" cy="30" r="2.5" class="a2"/><circle cx="22" cy="8" r="2.5" class="a2"/><circle cx="48" cy="10" r="2.5" class="a2"/><circle cx="52" cy="32" r="2.5" class="a2"/></svg>')}
      ${fieldCard('f-contour', 'Vrstevnice', 'Interpolace mezi výškovými body', '<svg viewBox="0 0 60 40"><path d="M8 32 30 6 52 30Z" class="a6"/><path d="M14 25C24 20 34 22 47 24" class="a3"/><circle cx="8" cy="32" r="2" class="a2"/><circle cx="30" cy="6" r="2" class="a2"/><circle cx="52" cy="30" r="2" class="a2"/></svg>')}
      ${fieldCard('f-sky', 'Geometrie družic', 'Vyber 4 družice s nejnižším PDOP', '<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="17" class="a7"/><circle cx="30" cy="20" r="3" class="a2"/><circle cx="16" cy="14" r="3" class="a2"/><circle cx="44" cy="12" r="3" class="a2"/><circle cx="36" cy="33" r="3" class="a2"/></svg>')}
      ${fieldCard('f-rod', 'Čtení latě', 'Trénink oka na milimetry', '<svg viewBox="0 0 60 40"><circle cx="30" cy="20" r="16" class="a7"/><rect x="25" y="4" width="10" height="32" class="a9"/><path d="M14 20h32M30 4v32" class="a6"/></svg>')}
    </div>
    <button class="btn blue wide" data-p="f-all">Terénní směs · 6 úloh</button>
    <h3 class="sec">Zkoušky nanečisto</h3>
    <div class="exams">${Object.entries(EXAMS).map(([lvl, cfg]) => {
      const best = s.exams?.[lvl];
      return `<button class="exam-card" data-exam-lvl="${lvl}"><span class="grade-s ${best ? 'g' + best.grade : ''}">${best ? best.grade : '–'}</span>
        <b>${cfg.title}</b><small>${cfg.length} otázek · ${cfg.minutes} min${best ? ` · nejlépe ${best.pct} %` : ''}</small></button>`;
    }).join('')}</div>
    <h3 class="sec">Výpočty</h3>
    ${card('calc', '🧮', 'Rychlé výpočty', 'Nekonečné příklady se stále novými čísly')}
    ${card('coords', '📍', 'Souřadnicové úlohy', 'Směrník, délka, polární metoda, výměry')}
    ${card('angles', '📐', 'Převody úhlů', 'gony, stupně, DMS, radiány')}
    ${card('level', '⚖️', 'Nivelace', 'Převýšení, výšky, uzávěry, mezní odchylky')}
    ${card('vs', '🎓', 'Vysokoškolské výpočty', 'Poloměry křivosti, exces, MNČ, výšky, fotogrammetrie')}
    <h3 class="sec">Opakování</h3>
    ${card('mistakes', '🔁', 'Opakovat chyby', s.mistakes.length ? `${s.mistakes.length} otázek, které ti nešly` : 'Zatím žádné chyby 🎉', !s.mistakes.length)}
    ${card('rusty', '🧹', 'Oprášit staré lekce', rusty.length ? `${rusty.length} lekcí neopakovaných déle než ${RUSTY_DAYS} dní` : 'Všechno máš čerstvě procvičené', !rusty.length)}
    ${card('mix', '🎲', 'Mix z probraného', doneIds.length ? `Náhodné otázky z ${doneIds.length} dokončených lekcí` : 'Nejdřív dokonči nějakou lekci', !doneIds.length)}
  </div>` + tabs();
  app.querySelectorAll('[data-exam-lvl]').forEach((b) => b.addEventListener('click', () => {
    const cfg = EXAMS[b.dataset.examLvl];
    if (confirm(`${cfg.title}: ${cfg.length} otázek, limit ${cfg.minutes} minut. Hodnotí se stupnicí A–F, na úspěch potřebuješ aspoň 50 %. Začít?`)) startExam(b.dataset.examLvl);
  }));
  app.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.p;
    if (p === 'mistakes') startPractice(buildMistakes(s.mistakes), 'Opakování chyb');
    else if (p === 'mix') startPractice(buildMix(doneIds), 'Mix');
    else if (p === 'rusty') startPractice(buildMix(rusty), 'Oprášení', rusty);
    else if (p === 'calc') startPractice(buildCalcPractice(10), 'Výpočty');
    else if (p === 'f-rod') startPractice(buildCalcPractice(6, ['rod']), 'Lať');
    else if (p === 'f-circle') startPractice(buildCalcPractice(6, ['hzCircle', 'vCircle']), 'Čtení kruhů');
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
    <h3 class="sec">Totiho výbava</h3>
    <div class="outfit">${OUTFIT.map((it) => {
      const unlocked = rk.index >= it.rank, on = (s.outfit ?? {})[it.slot] === it.id;
      return `<button class="gear ${on ? 'on' : ''}" data-gear="${it.id}" ${unlocked ? '' : 'disabled'}>
        <span class="gear-prev">${mascot('happy', '', { [it.slot]: it.id })}</span><b>${it.name}</b><small>${unlocked ? (on ? 'Nasazeno' : 'Nasadit') : `od hodnosti ${store.RANKS[it.rank].title}`}</small></button>`;
    }).join('')}</div>
    <div class="grid2">
      <div class="statbox">${ICON.flame}<b>${s.streak}</b><small>dní v terénu v řadě</small></div>
      <div class="statbox">${ICON.star}<b>${s.xp}</b><small>celkem XP</small></div>
      <div class="statbox"><span class="emo">📚</span><b>${doneCount} / ${LESSONS.length}</b><small>lekcí dokončeno</small></div>
      <div class="statbox"><span class="emo">🎯</span><b>${acc} %</b><small>přesnost odpovědí</small></div>
      <div class="statbox"><span class="emo">🦺</span><b>${s.stats.field}</b><small>terénních úloh</small></div>
      <div class="statbox"><span class="emo">🔋</span><b>${s.freezes ?? 0} / 2</b><small>náhradní akumulátory (za 7 dní v řadě)</small></div>
      <div class="statbox"><span class="emo">🧮</span><b>${s.stats.calc}</b><small>správných výpočtů</small></div>
    </div>
    <h3 class="sec">Mapa znalostí</h3>${knowledgeMap()}
    <h3 class="sec">Deník v terénu</h3>${heatmap(s.history ?? {})}
    <div class="row goalrow">${ring}<div class="grow"><b>Denní cíl</b><div class="hint">Dnes ${s.xpToday} z ${s.dailyGoal} XP</div></div></div>
    <div class="goal">${[10, 20, 30, 50].map((g) => `<button class="btn ${s.dailyGoal === g ? 'blue' : ''}" data-goal="${g}">${g} XP</button>`).join('')}</div>
    <h3 class="sec">Úspěchy</h3>
    <div class="ach-grid">${store.ACHIEVEMENTS.map((a) => `<div class="ach ${s.achievements.includes(a.id) ? '' : 'locked'}"><span class="ic">${a.icon}</span><b>${esc(a.title)}</b><small>${esc(a.desc)}</small></div>`).join('')}</div>
    <h3 class="sec">Nastavení</h3>
    <div class="seg"><span>Studuji</span><button data-track="ss" class="${s.track !== 'vs' ? 'on' : ''}">Střední školu</button><button data-track="vs" class="${s.track === 'vs' ? 'on' : ''}">Vysokou školu</button></div>
    <div class="seg"><span>Písmo</span>${[['m', 'Normální'], ['l', 'Větší']].map(([v, t]) => `<button data-text-set="${v}" class="${(s.textSize ?? 'm') === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <div class="seg"><span>Vzhled</span>${[['auto', 'Auto'], ['light', 'Světlý'], ['dark', 'Tmavý']].map(([v, t]) => `<button data-theme-set="${v}" class="${(s.theme ?? 'auto') === v ? 'on' : ''}">${t}</button>`).join('')}</div>
    <label class="toggle">Zvuky <input type="checkbox" id="snd" ${s.sound ? 'checked' : ''}></label>
    <label class="toggle">Odemknout všechny lekce <input type="checkbox" id="unl" ${s.unlockAll ? 'checked' : ''}></label>
    <button class="btn wide" id="share">📤 Sdílet pokrok</button>
    <p class="hint">Pokrok se ukládá jen v tomto zařízení.</p>
    <button class="btn red wide" id="reset">Smazat pokrok</button>
  </div>` + tabs();
  app.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => { s.dailyGoal = +b.dataset.goal; store.save(); renderProfile(); }));
  app.querySelectorAll('[data-track]').forEach((b) => b.addEventListener('click', () => { s.track = b.dataset.track; store.save(); renderProfile(); }));
  app.querySelectorAll('[data-gear]').forEach((b) => b.addEventListener('click', () => {
    const it = OUTFIT.find((x) => x.id === b.dataset.gear);
    s.outfit = { ...(s.outfit ?? {}) };
    s.outfit[it.slot] = s.outfit[it.slot] === it.id ? null : it.id;
    store.save(); beep('tick'); renderProfile();
  }));
  app.querySelectorAll('[data-text-set]').forEach((b) => b.addEventListener('click', () => { s.textSize = b.dataset.textSet; store.save(); applyTheme(); renderProfile(); }));
  app.querySelectorAll('[data-theme-set]').forEach((b) => b.addEventListener('click', () => { s.theme = b.dataset.themeSet; store.save(); applyTheme(); renderProfile(); }));
  app.querySelectorAll('[data-km]').forEach((b) => b.addEventListener('click', () => {
    const u = UNITS[+b.dataset.km];
    scrollMemory = null; show('path');
    setTimeout(() => document.getElementById(`unit-${b.dataset.km}`)?.scrollIntoView({ block: 'start' }), 50);
  }));
  app.querySelectorAll('[data-weak]').forEach((b) => b.addEventListener('click', () => {
    const u = UNITS.find((x) => x.id === b.dataset.weak);
    begin(buildUnitTest(u, 10), { lessonId: null, unitId: u.id, title: `Procvičení: ${u.title}`, practice: true, color: u.color });
  }));
  $('#share').addEventListener('click', async () => {
    const text = `Učím se geodézii v Geolingu 🧭 ${rk.title} · ${s.xp} XP · 🔥 ${s.streak} dní v terénu · ${doneCount}/${LESSONS.length} lekcí`;
    try {
      if (navigator.share) await navigator.share({ title: 'Geolingo', text, url: location.href.split('#')[0] });
      else { await navigator.clipboard.writeText(`${text} ${location.href.split('#')[0]}`); toast('Zkopírováno do schránky'); }
    } catch { /* zrušeno */ }
  });
  $('#snd').addEventListener('change', (e) => { s.sound = e.target.checked; store.save(); });
  $('#unl').addEventListener('change', (e) => { s.unlockAll = e.target.checked; store.save(); });
  $('#reset').addEventListener('click', () => { if (confirm('Opravdu smazat veškerý pokrok?')) { store.reset(); toast('Pokrok smazán'); renderProfile(); } });
}

/** Mapa znalostí: klad všech listů obarvený podle postupu + nejslabší kapitoly podle úspěšnosti. */
function knowledgeMap() {
  const s = store.S(), by = s.stats.byUnit ?? {};
  const tiles = UNITS.map((u, ui) => {
    const done = u.lessons.filter((l) => isDone(l.id)).length / u.lessons.length;
    const st = by[u.id], acc = st && st.a ? st.c / st.a : null;
    return `<button class="km-tile" data-km="${ui}" style="--c:${u.color};--f:${done}" title="${esc(u.title)}${acc != null ? ` · úspěšnost ${Math.round(acc * 100)} %` : ''}">
      <span>${ui + 1}</span>${store.S().unitTests?.[u.id] ? '<i>🏆</i>' : ''}</button>`;
  }).join('');
  const weak = UNITS.map((u) => ({ u, st: by[u.id] })).filter((x) => x.st && x.st.a >= 6)
    .map((x) => ({ ...x, acc: x.st.c / x.st.a })).sort((a, b) => a.acc - b.acc).slice(0, 3);
  return `<div class="km"><div class="km-grid">${tiles}</div>
    <div class="km-legend"><span>Sytost = dokončené lekce kapitoly · 🏆 = zkouška listu</span></div>
    ${weak.length ? `<div class="km-weak"><b>Kde to ještě drhne</b>${weak.map((w) => `<div class="kw"><span class="grow">${esc(w.u.title)}<div class="qbar"><i style="width:${w.acc * 100}%;background:${w.acc < 0.6 ? 'var(--red)' : w.acc < 0.8 ? 'var(--gold)' : 'var(--green)'}"></i><em>${Math.round(w.acc * 100)} % správně</em></div></span><button class="btn" data-weak="${w.u.id}">Procvičit</button></div>`).join('')}</div>`
      : '<p class="hint">Až odpovíš na víc otázek, ukážu ti kapitoly, které ti jdou nejhůř.</p>'}
  </div>`;
}

/** Kalendář aktivity: posledních 16 týdnů, sytost podle získaných XP. */
function heatmap(hist) {
  const day = (d) => d.toLocaleDateString('sv-SE');
  const now = new Date(); now.setHours(12, 0, 0, 0);
  const start = new Date(now); start.setDate(start.getDate() - ((now.getDay() + 6) % 7) - 7 * 15);
  const cells = [];
  let total = 0, active = 0;
  for (let i = 0; i < 16 * 7; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const xp = hist[day(d)] ?? 0, future = d > now;
    if (xp) { total += xp; active++; }
    const lv = future ? 'f' : xp === 0 ? 0 : xp < 15 ? 1 : xp < 30 ? 2 : xp < 50 ? 3 : 4;
    cells.push(`<i class="h${lv}" title="${d.toLocaleDateString('cs-CZ')}: ${xp} XP"></i>`);
  }
  return `<div class="heat"><div class="heat-grid">${cells.join('')}</div>
    <div class="heat-legend"><span>${active} dní v terénu · ${total} XP za 16 týdnů</span><span class="scale">méně <i class="h1"></i><i class="h2"></i><i class="h3"></i><i class="h4"></i> více</span></div></div>`;
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
    welcomeGoal();
  }));
}

function welcomeGoal() {
  const goals = [[10, 'Pohodově', '≈ 1 lekce denně'], [20, 'Pravidelně', '≈ 2 lekce denně'], [30, 'Vážně', 'na zkoušky'], [50, 'Intenzivně', 'jako v terénu']];
  app.innerHTML = `<div class="done-screen welcome">
    ${mascot('wow', 'big')}
    <h1>Kolik času denně?</h1>
    <p>Nastav si denní cíl. Změnit ho můžeš kdykoli v profilu.</p>
    <div class="goal-pick">${goals.map(([xp, t, d]) => `<button class="choice" data-goal="${xp}"><b>${t}</b><small>${xp} XP · ${d}</small></button>`).join('')}</div>
  </div>`;
  app.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => {
    store.S().dailyGoal = +b.dataset.goal; store.save();
    localStorage.setItem('geolingo.onboarded', '1');
    show('path');
  }));
}

function applyTheme() {
  document.documentElement.dataset.text = store.S().textSize ?? 'm';
  const t = store.S().theme ?? 'auto';
  if (t === 'auto') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0c1d22' : '#0f4c5c');
}
applyTheme();
backdrop();
store.tick();
if (store.S().freezeUsedOn === new Date().toLocaleDateString('sv-SE') && !sessionStorage.getItem('frzShown')) { setTimeout(() => toast('🔋 Náhradní akumulátor zachránil tvou sérii!'), 800); try { sessionStorage.setItem('frzShown', '1'); } catch { /* */ } }
if (localStorage.getItem('geolingo.onboarded')) show('path'); else welcome();
setInterval(() => { if (!run && !document.querySelector('.sheet-bg')) { const before = store.S().hearts; store.tick(); if (store.S().hearts !== before && tab !== 'profile') show(tab); } }, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
  // Nová verze aplikace převzala řízení → nabídnout načtení (uprostřed lekce jen oznámit).
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || document.getElementById('update')) return;
    const bar = document.createElement('div');
    bar.id = 'update';
    bar.innerHTML = `${mascot('wow')}<span><b>Nová verze Geolinga</b><small>Toti se naučil něco nového.</small></span><button class="btn primary">Načíst</button>`;
    bar.querySelector('button').addEventListener('click', () => location.reload());
    document.body.append(bar);
  });
}

// Pro testy v prohlížeči.
window.__geolingo = { store, LESSONS, startLesson, startPractice, buildCalcPractice, buildFieldPractice, shuffle, current: () => run && run.items[run.i] };

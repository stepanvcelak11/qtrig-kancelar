// Geolingo – uživatelské rozhraní (cesta lekcí, cvičení, procvičování, profil).

import { UNITS, LESSONS, lessonById, buildLesson, buildCalcPractice, buildMistakes, buildMix, grade, correctText, prepare, shuffle } from './engine.js';
import { fmt } from './generators.js';
import * as store from './store.js';

const $ = (sel, root = document) => root.querySelector(sel);
const app = $('#app');
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------------------------------------------------------------------------------------
// Maskot Toti (totální stanice na stativu: žluté tělo, displej s očima, dalekohled, laser)

function mascot(mood = 'happy') {
  const sad = mood === 'sad', wow = mood === 'wow';
  const eyeY = sad ? 55 : 52, eyeH = wow ? 10 : sad ? 5 : 8;
  const mouth = sad ? 'M45 68 Q50 64 55 68' : wow ? 'M47 66 Q50 71 53 66 Z' : 'M44 65 Q50 70 56 65';
  return `<svg viewBox="0 0 100 100" aria-hidden="true">
    <g stroke="#c77a2a" stroke-width="5" stroke-linecap="round"><line x1="50" y1="80" x2="24" y2="98"/><line x1="50" y1="80" x2="76" y2="98"/><line x1="50" y1="80" x2="50" y2="99"/></g>
    <g fill="#8a5a2b"><circle cx="24" cy="98" r="2.5"/><circle cx="76" cy="98" r="2.5"/></g>
    <rect x="30" y="76" width="40" height="7" rx="3" fill="#4a4a4a"/>
    <rect x="36" y="71" width="28" height="7" rx="2" fill="#6b6b6b"/>
    <path d="M28 30 v-8 a4 4 0 0 1 4 -4 M72 30 v-8 a4 4 0 0 0 -4 -4" fill="none" stroke="#3c3c3c" stroke-width="4" stroke-linecap="round"/>
    <rect x="42" y="12" width="20" height="12" rx="4" fill="#3c3c3c"/><circle cx="62" cy="18" r="4" fill="#1cb0f6"/>
    <line x1="66" y1="18" x2="96" y2="18" stroke="#ff4b4b" stroke-width="1.6" stroke-dasharray="3 2"/><circle cx="96" cy="18" r="2" fill="#ff4b4b"/>
    <rect x="24" y="24" width="52" height="50" rx="10" fill="#ffc800" stroke="#e5a600" stroke-width="3"/>
    <rect x="25.5" y="31" width="49" height="8" fill="#2fbf71"/>
    <rect x="33" y="43" width="34" height="26" rx="6" fill="#1f2b33"/>
    <rect x="${sad ? 39 : 40}" y="${eyeY - eyeH / 2}" width="6" height="${eyeH}" rx="2" fill="#7fe3ff"/>
    <rect x="${sad ? 55 : 54}" y="${eyeY - eyeH / 2}" width="6" height="${eyeH}" rx="2" fill="#7fe3ff"/>
    <path d="${mouth}" fill="${wow ? '#7fe3ff' : 'none'}" stroke="#7fe3ff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}

// ---------------------------------------------------------------------------------------
// Zvuky (Web Audio, bez souborů)

let audio = null;
function beep(kind) {
  if (!store.S().sound) return;
  try {
    audio ??= new (window.AudioContext || window.webkitAudioContext)();
    const notes = kind === 'ok' ? [[660, 0], [880, 0.09]] : kind === 'done' ? [[523, 0], [659, 0.1], [784, 0.2], [1046, 0.3]] : [[220, 0], [180, 0.12]];
    for (const [f, t] of notes) {
      const o = audio.createOscillator(), g = audio.createGain();
      o.type = kind === 'bad' ? 'sawtooth' : 'triangle'; o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, audio.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.18, audio.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, audio.currentTime + t + 0.18);
      o.connect(g).connect(audio.destination); o.start(audio.currentTime + t); o.stop(audio.currentTime + t + 0.2);
    }
  } catch { /* bez zvuku */ }
  navigator.vibrate?.(kind === 'bad' ? [30, 40, 30] : 15);
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
  return `<header class="top">
    <div class="stat fire" title="Série dní">🔥 ${s.streak}</div>
    <div class="stat xp" title="Zkušenosti">⭐ ${s.xp}</div>
    <div class="stat heart" title="Životy">❤️ ${s.hearts}</div>
  </header>`;
}

function tabs() {
  const b = (id, ic, label) => `<button data-tab="${id}" class="${tab === id ? 'on' : ''}">${ic}<span>${label}</span></button>`;
  return `<nav class="tabs"><div>${b('path', '🏠', 'Učení')}${b('practice', '🎯', 'Procvičovat')}${b('profile', '👤', 'Profil')}</div></nav>`;
}

function show(which) {
  tab = which;
  store.tick();
  if (which === 'path') renderPath();
  else if (which === 'practice') renderPractice();
  else renderProfile();
  window.scrollTo(0, which === 'path' ? scrollMemory : 0);
}
let scrollMemory = 0;

app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-tab]');
  if (t) { if (tab === 'path') scrollMemory = window.scrollY; show(t.dataset.tab); }
});

// ---------------------------------------------------------------------------------------
// Cesta lekcí

const isDone = (id) => (store.S().done[id] ?? 0) > 0;
function isUnlocked(index) {
  return store.S().unlockAll || index === 0 || isDone(LESSONS[index - 1].id);
}
function currentIndex() {
  const i = LESSONS.findIndex((l, k) => isUnlocked(k) && !isDone(l.id));
  return i === -1 ? LESSONS.length - 1 : i;
}

const ZIGZAG = [0, 55, 80, 55, 0, -55, -80, -55];

function renderPath() {
  const cur = currentIndex();
  let k = 0;
  const html = UNITS.map((u, ui) => `
    <section class="unit" style="--c:${u.color}">
      <div class="unit-head"><small>Kapitola ${ui + 1}</small><h2>${esc(u.title)}</h2><p>${esc(u.desc)}</p></div>
      <div class="nodes">${u.lessons.map((l, li) => {
        const index = k++;
        const done = isDone(l.id), unlocked = isUnlocked(index);
        const cls = done ? 'done' : !unlocked ? 'locked' : index === cur ? 'current' : '';
        const crowns = store.S().done[l.id] ?? 0;
        return `<div class="node-wrap" style="transform:translateX(${ZIGZAG[(ui * 5 + li) % ZIGZAG.length]}px)">
          ${index === cur && !done ? '<div class="start-tip">Start</div>' : ''}
          <button class="node ${cls}" data-lesson="${l.id}" aria-label="${esc(l.title)}">${unlocked ? l.icon : '🔒'}${crowns ? `<span class="crown">${Math.min(crowns, 5)}</span>` : ''}</button>
          <div class="node-label">${esc(l.title)}</div></div>`;
      }).join('')}</div>
    </section>`).join('');
  app.innerHTML = topStats() + `<main class="path">${html}</main>` + tabs();
  app.querySelectorAll('[data-lesson]').forEach((b) => b.addEventListener('click', () => lessonSheet(b.dataset.lesson)));
}

function lessonSheet(id) {
  const l = lessonById(id), index = LESSONS.indexOf(l), unlocked = isUnlocked(index), times = store.S().done[id] ?? 0;
  const bg = document.createElement('div');
  bg.className = 'sheet-bg';
  bg.innerHTML = `<div class="sheet" style="--c:${l.unit.color}">
    <h3>${l.icon} ${esc(l.title)}</h3>
    <p>Kapitola ${l.unitIndex + 1}: ${esc(l.unit.title)} · lekce ${l.lessonIndex + 1} z ${l.unit.lessons.length}${times ? ` · dokončeno ${times}×` : ''}${l.gens?.length ? ' · obsahuje výpočty 🧮' : ''}</p>
    ${unlocked ? `<button class="btn primary wide" id="go">${times ? 'Opakovat lekci (+10 XP)' : 'Začít lekci (+10 XP)'}</button>`
      : '<button class="btn wide" disabled>🔒 Nejdřív dokonči předchozí lekci</button>'}
  </div>`;
  bg.addEventListener('click', (e) => { if (e.target === bg) bg.remove(); });
  document.body.append(bg);
  $('#go', bg)?.addEventListener('click', () => { bg.remove(); scrollMemory = window.scrollY; startLesson(id); });
}

// ---------------------------------------------------------------------------------------
// Běh lekce

let run = null;

function startLesson(id) {
  store.tick();
  if (store.S().hearts <= 0) return noHearts();
  const l = lessonById(id);
  begin(buildLesson(l), { lessonId: id, title: l.title, practice: false });
}

function startPractice(items, title) {
  if (!items.length) { toast('Zatím tu nic není'); return; }
  begin(items, { lessonId: null, title, practice: true });
}

function begin(items, meta) {
  run = { items, i: 0, mistakes: 0, correct: 0, retried: new Set(), meta, answer: null, locked: false, started: Date.now() };
  renderExercise();
}

const KIND = { c: 'Vyber správnou odpověď', tf: 'Pravda, nebo ne?', m: 'Spoj dvojice', o: 'Seřaď kroky', n: 'Vypočítej', rod: 'Odečti lať' };

function renderExercise() {
  const ex = run.items[run.i];
  run.answer = null; run.locked = false;
  const pct = Math.round((run.i / run.items.length) * 100);
  app.innerHTML = `<div class="lesson">
    <div class="lesson-top"><button class="x" id="quit" aria-label="Ukončit">✕</button><div class="bar"><i style="width:${pct}%"></i></div>
      ${run.meta.practice ? '<span class="stat xp">🎯</span>' : `<span class="stat heart">❤️ ${store.S().hearts}</span>`}</div>
    <div class="ex"><div class="kind">${KIND[ex.t]}</div>${exerciseBody(ex)}</div>
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
        <div class="opts">${ex.options.map((o, i) => `<button class="opt" data-i="${i}">${esc(o)}</button>`).join('')}</div>`;
    case 'tf':
      return `<p class="prompt">${esc(ex.q)}</p>
        <div class="tf"><button class="opt" data-v="1">✅ Pravda</button><button class="opt" data-v="0">❌ Nepravda</button></div>`;
    case 'm':
      return `<p class="prompt">${esc(ex.q)}</p>
        <div class="match"><div class="col">${ex.left.map((s) => `<button class="opt" data-side="l" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div>
        <div class="col">${ex.right.map((s) => `<button class="opt" data-side="r" data-v="${esc(s)}">${esc(s)}</button>`).join('')}</div></div>`;
    case 'o':
      return `<p class="prompt">${esc(ex.q)}</p><div class="answer-zone tiles" id="zone"></div><div class="tiles" id="bank"></div>`;
    case 'n':
      return `<p class="prompt">${esc(ex.q)}</p>
        <div class="numrow"><input class="num" id="num" inputmode="decimal" autocomplete="off" placeholder="Výsledek"><span class="unit-label">${esc(ex.unit ?? '')}</span></div>
        <div class="hint">Zaokrouhli na ${ex.dec} ${ex.dec === 1 ? 'desetinné místo' : ex.dec >= 2 && ex.dec <= 4 ? 'desetinná místa' : 'desetinných míst'}${ex.dec === 0 ? ' (celé číslo)' : ''}. Desetinná čárka i tečka jsou v pořádku.</div>`;
    case 'rod':
      return `<p class="prompt">Jaké je čtení na lati na vodorovném vlákně nitkového kříže?</p>
        <canvas class="rod" id="rodCanvas" width="600" height="600"></canvas>
        <div class="numrow"><input class="num" id="num" inputmode="decimal" autocomplete="off" placeholder="např. 1,437"><span class="unit-label">m</span></div>
        <div class="hint">Číslo na lati = decimetry (spodní okraj čísla je celý dm), políčka = centimetry, milimetry odhadni.</div>`;
    default: return '';
  }
}

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
      zone.innerHTML = order.map((s, i) => `<button class="tile" data-z="${i}"><span class="n">${i + 1}.</span>${esc(s)}</button>`).join('')
        || '<div class="hint">Klepej na kroky ve správném pořadí…</div>';
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
}

function check() {
  if (run.locked || run.answer == null) return;
  const ex = run.items[run.i];
  finishExercise(grade(ex, run.answer), ex);
}

function finishExercise(ok, ex) {
  run.locked = true;
  store.recordAnswer(ex, ok);
  if (ok) run.correct++;
  else {
    run.mistakes++;
    if (!run.meta.practice) store.loseHeart();
    // Chybnou otázku zopakovat na konci (jednou).
    const key = run.i;
    if (!run.retried.has(key) && ex.t !== 'm') {
      run.retried.add(run.items.length);
      run.items.push(ex.t === 'n' || ex.t === 'rod' ? ex : prepare(ex, ex.ref));
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
  const praise = ['Výborně!', 'Skvěle!', 'Přesně tak!', 'Paráda!', 'Správně!'];
  const fb = document.createElement('div');
  fb.className = `feedback ${ok ? 'ok' : 'bad'}`;
  const showAnswer = !ok && ex.t !== 'm';
  fb.innerHTML = `<div>
    <h3>${ok ? '✅ ' + praise[Math.floor(Math.random() * praise.length)] : '❌ Správná odpověď:'}</h3>
    ${showAnswer ? `<div class="ans">${esc(correctText(ex, fmt))}</div>` : ''}
    ${ex.e ? `<div class="exp">${esc(ex.e)}</div>` : ''}
    <button class="btn ${ok ? 'primary' : 'red'} wide" id="next">Pokračovat</button></div>`;
  $('.check-bar')?.remove();
  app.append(fb);
  $('#next').focus();
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
  app.innerHTML = `<div class="done-screen">
    ${mascot('wow')}
    <h1>${r.meta.practice ? 'Procvičení hotovo!' : 'Lekce dokončena!'}</h1>
    <div class="cards">
      <div class="card" style="--c:var(--gold)"><b>XP</b><span>+${result.xp}</span></div>
      <div class="card" style="--c:var(--green)"><b>Přesnost</b><span>${acc} %</span></div>
      <div class="card" style="--c:var(--blue)"><b>Čas</b><span>${mins} min</span></div>
    </div>
    ${result.streakUp ? `<p><b>🔥 Série: ${s.streak} ${s.streak === 1 ? 'den' : s.streak < 5 ? 'dny' : 'dní'}!</b></p>` : ''}
    ${s.xpToday >= s.dailyGoal ? '<p>🎯 Denní cíl splněn!</p>' : `<p>Denní cíl: ${s.xpToday} / ${s.dailyGoal} XP</p>`}
    ${result.newAchievements.map((a) => `<p>🏅 Nový úspěch: <b>${a.icon} ${esc(a.title)}</b></p>`).join('')}
    ${r.meta.practice ? '<p>❤️ +1 život za procvičování</p>' : ''}
    <button class="btn primary wide" id="cont">Pokračovat</button>
  </div>`;
  confetti();
  $('#cont').addEventListener('click', () => show(r.meta.practice ? 'practice' : 'path'));
}

function noHearts() {
  const ms = store.nextHeartIn();
  app.innerHTML = `<div class="done-screen">${mascot('sad')}
    <h1 style="color:var(--red)">Došly ti životy</h1>
    <p>Další život za ${Math.ceil(ms / 60000)} min. Procvičováním získáš život hned.</p>
    <button class="btn blue wide" id="prac">🎯 Procvičovat</button>
    <button class="btn wide" id="home">Zpět</button></div>`;
  $('#prac').addEventListener('click', () => show('practice'));
  $('#home').addEventListener('click', () => show('path'));
}

function confetti() {
  const c = document.createElement('div');
  c.className = 'confetti';
  const colors = ['#58cc02', '#1cb0f6', '#ffc800', '#ff4b4b', '#ce82ff', '#ff9600'];
  c.innerHTML = Array.from({ length: 70 }, () => `<i style="left:${Math.random() * 100}%;background:${colors[Math.floor(Math.random() * colors.length)]};animation-delay:${Math.random() * 0.8}s;animation-duration:${1.8 + Math.random() * 1.4}s"></i>`).join('');
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
// Procvičování

function renderPractice() {
  const s = store.S();
  const doneIds = Object.keys(s.done);
  const card = (id, ic, title, desc, disabled = false) =>
    `<button class="tile-card" data-p="${id}" ${disabled ? 'disabled style="opacity:.5"' : ''}><span class="ic">${ic}</span><span class="grow"><b>${title}</b><small>${desc}</small></span></button>`;
  app.innerHTML = topStats() + `<div class="page">
    <h2>Procvičování</h2>
    <p class="hint">Procvičování nebere životy a za každé dokončení jeden život vrátí.</p>
    ${card('mistakes', '🔁', 'Opakovat chyby', s.mistakes.length ? `${s.mistakes.length} otázek, které ti nešly` : 'Zatím žádné chyby 🎉', !s.mistakes.length)}
    ${card('mix', '🎲', 'Mix z probraného', doneIds.length ? `Náhodné otázky z ${doneIds.length} dokončených lekcí` : 'Nejdřív dokonči nějakou lekci', !doneIds.length)}
    ${card('calc', '🧮', 'Rychlé výpočty', 'Nekonečné příklady se stále novými čísly')}
    ${card('coords', '📍', 'Souřadnicové úlohy', 'Směrník, délka, polární metoda, výměry')}
    ${card('angles', '📐', 'Převody úhlů', 'gony, stupně, DMS, radiány')}
    ${card('level', '⚖️', 'Nivelace', 'Převýšení, výšky, uzávěry, mezní odchylky')}
    ${card('rod', '📏', 'Odečítání latě', 'Trénink oka – čtení na mm')}
  </div>` + tabs();
  const sets = {
    coords: ['bearing', 'distance', 'polarY', 'polarX', 'areaTriangle', 'areaQuad'],
    angles: ['gonToDeg', 'degToGon', 'dmsToDeg', 'gonToRad', 'angleDiff'],
    level: ['levelDiff', 'levelHeight', 'levelClosure', 'levelLimit', 'horizonHeight', 'stadia'],
  };
  app.querySelectorAll('[data-p]').forEach((b) => b.addEventListener('click', () => {
    const p = b.dataset.p;
    if (p === 'mistakes') startPractice(buildMistakes(s.mistakes), 'Opakování chyb');
    else if (p === 'mix') startPractice(buildMix(doneIds), 'Mix');
    else if (p === 'calc') startPractice(buildCalcPractice(10), 'Výpočty');
    else if (p === 'rod') startPractice(buildCalcPractice(8, ['rod']), 'Lať');
    else startPractice(buildCalcPractice(10, sets[p]), b.querySelector('b').textContent);
  }));
}

// ---------------------------------------------------------------------------------------
// Profil

function renderProfile() {
  const s = store.S();
  const doneCount = Object.keys(s.done).length;
  const acc = s.stats.answered ? Math.round((s.stats.correct / s.stats.answered) * 100) : 0;
  const goalPct = Math.min(1, s.xpToday / s.dailyGoal);
  const ring = `<svg class="ring" viewBox="0 0 36 36"><circle cx="18" cy="18" r="15" fill="none" stroke="var(--line)" stroke-width="5"/>
    <circle cx="18" cy="18" r="15" fill="none" stroke="var(--gold)" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(goalPct * 94.2).toFixed(1)} 94.2" transform="rotate(-90 18 18)"/></svg>`;
  app.innerHTML = topStats() + `<div class="page">
    <div class="row profile-head">${mascot()}<div class="grow"><h2>Tvůj profil</h2><div class="hint">Pokrok se ukládá jen v tomto zařízení.</div></div></div>
    <div class="grid2">
      <div class="statbox"><b>🔥 ${s.streak}</b><small>dní v řadě</small></div>
      <div class="statbox"><b>⭐ ${s.xp}</b><small>celkem XP</small></div>
      <div class="statbox"><b>📚 ${doneCount} / ${LESSONS.length}</b><small>lekcí dokončeno</small></div>
      <div class="statbox"><b>🎯 ${acc} %</b><small>přesnost odpovědí</small></div>
    </div>
    <div class="row">${ring}<div class="grow"><b>Denní cíl</b><div class="hint">Dnes ${s.xpToday} z ${s.dailyGoal} XP</div></div></div>
    <div class="goal">${[10, 20, 30, 50].map((g) => `<button class="btn ${s.dailyGoal === g ? 'blue' : ''}" data-goal="${g}">${g} XP</button>`).join('')}</div>
    <h2>Nastavení</h2>
    <label class="toggle">Zvuky <input type="checkbox" id="snd" ${s.sound ? 'checked' : ''}></label>
    <label class="toggle">Odemknout všechny lekce (pro pokročilé) <input type="checkbox" id="unl" ${s.unlockAll ? 'checked' : ''}></label>
    <h2>Úspěchy</h2>
    ${store.ACHIEVEMENTS.map((a) => `<div class="ach ${s.achievements.includes(a.id) ? '' : 'locked'}"><span class="ic">${a.icon}</span><div><b>${esc(a.title)}</b><div class="hint">${esc(a.desc)}</div></div></div>`).join('')}
    <button class="btn red wide" id="reset" style="margin-top:12px">Smazat pokrok</button>
  </div>` + tabs();
  app.querySelectorAll('[data-goal]').forEach((b) => b.addEventListener('click', () => { s.dailyGoal = +b.dataset.goal; store.save(); renderProfile(); }));
  $('#snd').addEventListener('change', (e) => { s.sound = e.target.checked; store.save(); });
  $('#unl').addEventListener('change', (e) => { s.unlockAll = e.target.checked; store.save(); });
  $('#reset').addEventListener('click', () => { if (confirm('Opravdu smazat veškerý pokrok?')) { store.reset(); toast('Pokrok smazán'); renderProfile(); } });
}

// ---------------------------------------------------------------------------------------
// Úvod a start

function welcome() {
  app.innerHTML = `<div class="done-screen">
    ${mascot('happy')}
    <h1 style="color:var(--green)">Ahoj, já jsem Toti!</h1>
    <p>Naučím tě geodézii – od úhlů a souřadnic přes nivelaci a GNSS až po katastr. Pár minut denně stačí.</p>
    <p class="hint">10 kapitol · 50 lekcí · nekonečné výpočty</p>
    <button class="btn primary wide" id="go">Jdeme na to!</button>
  </div>`;
  $('#go').addEventListener('click', () => { localStorage.setItem('geolingo.onboarded', '1'); show('path'); });
}

store.tick();
if (localStorage.getItem('geolingo.onboarded')) show('path'); else welcome();
setInterval(() => { if (!run) { const before = store.S().hearts; store.tick(); if (store.S().hearts !== before && tab !== 'profile') show(tab); } }, 60000);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
}

// Pro testy v prohlížeči.
window.__geolingo = { store, LESSONS, startLesson, startPractice, buildCalcPractice, shuffle, current: () => run && run.items[run.i] };

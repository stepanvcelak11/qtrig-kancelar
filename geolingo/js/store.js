// Pokrok hráče v localStorage: XP, série dní, životy, dokončené lekce, chyby, úspěchy.

const KEY = 'geolingo.v1';
export const MAX_HEARTS = 5;
export const HEART_REGEN_MS = 20 * 60 * 1000;

// Místní datum (ne UTC), aby se den neměnil ve 2 hodiny ráno.
const localDay = (t) => new Date(t).toLocaleDateString('sv-SE');
const today = () => localDay(Date.now());
const yesterday = () => localDay(Date.now() - 86400000);

const defaults = () => ({
  xp: 0, streak: 0, lastDay: null, xpToday: 0, xpDay: today(), dailyGoal: 20,
  hearts: MAX_HEARTS, heartsAt: Date.now(),
  done: {}, perfect: {}, mistakes: [], stats: { answered: 0, correct: 0, calc: 0, rod: 0, lessons: 0 },
  achievements: [], unlockAll: false, sound: true,
});

let state;
try { state = { ...defaults(), ...JSON.parse(localStorage.getItem(KEY) || '{}') }; } catch { state = defaults(); }

export const S = () => state;

export function save() {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* soukromé okno apod. */ }
}

export function reset() {
  state = defaults();
  save();
}

/** Obnova životů v čase + přechod na nový den. */
export function tick() {
  const now = Date.now();
  if (state.hearts < MAX_HEARTS) {
    const gained = Math.floor((now - state.heartsAt) / HEART_REGEN_MS);
    if (gained > 0) {
      state.hearts = Math.min(MAX_HEARTS, state.hearts + gained);
      state.heartsAt = state.hearts >= MAX_HEARTS ? now : state.heartsAt + gained * HEART_REGEN_MS;
    }
  } else state.heartsAt = now;
  if (state.xpDay !== today()) { state.xpDay = today(); state.xpToday = 0; }
  // Série se přeruší, pokud včera ani dnes nebyla lekce.
  if (state.lastDay && state.lastDay !== today() && state.lastDay !== yesterday()) state.streak = 0;
  save();
}

export function nextHeartIn() {
  if (state.hearts >= MAX_HEARTS) return 0;
  return Math.max(0, HEART_REGEN_MS - (Date.now() - state.heartsAt));
}

export function loseHeart() {
  if (state.hearts === MAX_HEARTS) state.heartsAt = Date.now();
  state.hearts = Math.max(0, state.hearts - 1);
  save();
}

export function gainHeart() {
  state.hearts = Math.min(MAX_HEARTS, state.hearts + 1);
  save();
}

export function recordAnswer(ex, ok) {
  state.stats.answered++;
  if (ok) {
    state.stats.correct++;
    if (ex.t === 'n') state.stats.calc++;
    if (ex.t === 'rod') state.stats.rod++;
    if (ex.ref) state.mistakes = state.mistakes.filter((m) => !(m.lesson === ex.ref.lesson && m.idx === ex.ref.idx));
  } else if (ex.ref && !state.mistakes.some((m) => m.lesson === ex.ref.lesson && m.idx === ex.ref.idx)) {
    state.mistakes.push({ ...ex.ref });
    if (state.mistakes.length > 200) state.mistakes.shift();
  }
  save();
}

/** Dokončení lekce: XP, série, úspěchy. Vrací { xp, streakUp, newAchievements }. */
export function completeLesson(lessonId, { mistakes, practice = false }) {
  const xp = practice ? 5 : 10 + (mistakes === 0 ? 5 : 0);
  state.xp += xp;
  state.xpToday += xp;
  let streakUp = false;
  if (state.lastDay !== today()) {
    state.streak = state.lastDay === yesterday() ? state.streak + 1 : 1;
    state.lastDay = today();
    streakUp = true;
  }
  if (lessonId) {
    state.done[lessonId] = (state.done[lessonId] ?? 0) + 1;
    if (mistakes === 0) state.perfect[lessonId] = true;
    state.stats.lessons++;
  }
  const newAchievements = checkAchievements();
  save();
  return { xp, streakUp, newAchievements };
}

export const ACHIEVEMENTS = [
  { id: 'first', icon: '🎉', title: 'První krok', desc: 'Dokonči první lekci', test: (s) => s.stats.lessons >= 1 },
  { id: 'perfect', icon: '💯', title: 'Bez chyby', desc: 'Dokonči lekci bez jediné chyby', test: (s) => Object.keys(s.perfect).length >= 1 },
  { id: 'streak3', icon: '🔥', title: 'Rozehřátý', desc: 'Série 3 dnů', test: (s) => s.streak >= 3 },
  { id: 'streak7', icon: '🌋', title: 'Týden v kuse', desc: 'Série 7 dnů', test: (s) => s.streak >= 7 },
  { id: 'calc50', icon: '🧮', title: 'Počtář', desc: '50 správných výpočtů', test: (s) => s.stats.calc >= 50 },
  { id: 'rod20', icon: '📏', title: 'Oko figuranta', desc: '20× správně odečtená lať', test: (s) => s.stats.rod >= 20 },
  { id: 'xp500', icon: '⭐', title: 'Pětistovka', desc: 'Získej 500 XP', test: (s) => s.xp >= 500 },
  { id: 'lessons25', icon: '🎓', title: 'Půlka osnovy', desc: 'Dokonči 25 různých lekcí', test: (s) => Object.keys(s.done).length >= 25 },
  { id: 'all', icon: '🏆', title: 'Geodet', desc: 'Dokonči všech 50 lekcí', test: (s) => Object.keys(s.done).length >= 50 },
];

function checkAchievements() {
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!state.achievements.includes(a.id) && a.test(state)) { state.achievements.push(a.id); fresh.push(a); }
  }
  return fresh;
}

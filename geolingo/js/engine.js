// Skládání lekcí a hodnocení odpovědí (bez DOM – testovatelné v Node).

import U1 from './content/u01-03.js';
import U2 from './content/u04-06.js';
import U3 from './content/u07-10.js';
import U4 from './content/u11-13.js';
import U5 from './content/u14-16.js';
import B1 from './content/vut-bc1.js';
import B2 from './content/vut-bc2.js';
import B3 from './content/vut-bc3.js';
import I1 from './content/vut-ing1.js';
import I2 from './content/vut-ing2.js';
import I3 from './content/vut-ing3.js';
import T1 from './content/tips-1.js';
import T2 from './content/tips-2.js';
import T3 from './content/tips-3.js';
import T4 from './content/tips-4.js';

/** Taháky ke kapitolám podle id kapitoly. */
export const TIPS = { ...T1, ...T2, ...T3, ...T4 };
import { generate, GEN } from './generators.js';
import { checkField, FIELD_TYPES } from './field.js';

// Pořadí: SŠ kapitoly podle osnovy, pak VŠ podle úrovně (Bc. → Ing.) a semestru (např. „2. ročník · LS“).
const LEVEL_ORDER = { 'SŠ': 0, 'Bc.': 1, 'Ing.': 2 };
export const semKey = (u) => {
  const m = /(\d)\.\s*ročník\s*·\s*(ZS|LS)/.exec(u.sem ?? '');
  return m ? Number(m[1]) * 2 - (m[2] === 'ZS' ? 1 : 0) : 99;
};
export const UNITS = [...U1, ...U2, ...U3, ...U4, ...U5, ...B1, ...B2, ...B3, ...I1, ...I2, ...I3]
  .map((u, i) => ({ u, i }))
  .sort((a, b) => (LEVEL_ORDER[a.u.level ?? 'SŠ'] ?? 1) - (LEVEL_ORDER[b.u.level ?? 'SŠ'] ?? 1) || semKey(a.u) - semKey(b.u) || a.i - b.i)
  .map(({ u }) => u);
export const LESSONS = UNITS.flatMap((u, ui) => u.lessons.map((l, li) => ({ ...l, unit: u, unitIndex: ui, lessonIndex: li })));
export const lessonById = (id) => LESSONS.find((l) => l.id === id);

export const LESSON_LENGTH = 8;

export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Připraví cvičení k zobrazení (zamíchá možnosti atd.). */
export function prepare(item, ref = null) {
  const ex = { ...item, ref };
  if (item.t === 'c') ex.options = shuffle([item.a, ...item.w]);
  if (item.t === 'm') { ex.left = shuffle(item.p.map((p) => p[0])); ex.right = shuffle(item.p.map((p) => p[1])); }
  if (item.t === 'o') {
    let order = shuffle(item.s);
    // Nikdy nezačínat už seřazeným pořadím.
    for (let k = 0; k < 5 && order.every((s, i) => s === item.s[i]); k++) order = shuffle(item.s);
    ex.bank = order;
  }
  return ex;
}

/** Sestaví běh lekce: statické otázky + generované výpočty. */
export function buildLesson(lesson, length = LESSON_LENGTH) {
  const gens = lesson.gens ?? [];
  // Terénní úlohy jsou v lekci každá jednou, výpočty doplní zbytek.
  const field = gens.filter((g) => FIELD_TYPES.includes(g));
  const calc = gens.filter((g) => !FIELD_TYPES.includes(g));
  const nCalc = calc.length ? Math.min(length - 3, Math.max(2, Math.round(length * (calc.length >= 3 ? 0.5 : 0.35)))) : 0;
  const statics = shuffle(lesson.items.map((it, i) => ({ it, i }))).slice(0, length - nCalc - field.length);
  const list = statics.map(({ it, i }) => prepare(it, { lesson: lesson.id, idx: i }));
  for (const g of field) list.push(prepare(generate(g)));
  const order = shuffle(calc);
  for (let k = 0; calc.length && list.length < length; k++) list.push(prepare(generate(order[k % order.length])));
  return shuffle(list);
}

/** Zkouška listu: průřez všemi lekcemi kapitoly (otázky, výpočty i terénní úlohy). */
export function buildUnitTest(unit, length = 12) {
  const pool = unit.lessons.flatMap((l) => l.items.map((it, i) => ({ l, it, i })));
  const gens = [...new Set(unit.lessons.flatMap((l) => l.gens ?? []))];
  const nGen = Math.min(gens.length, 4);
  const list = shuffle(pool).slice(0, length - nGen).map(({ l, it, i }) => prepare(it, { lesson: l.id, idx: i }));
  for (const g of shuffle(gens).slice(0, nGen)) list.push(prepare(generate(g)));
  return shuffle(list);
}

/** Terénní praxe: praktické úlohy (výběr stanoviska, vytyčení, libela…). */
export function buildFieldPractice(length = 6, only = null) {
  const names = only ?? FIELD_TYPES;
  return Array.from({ length }, (_, i) => prepare(generate(names[i % names.length])));
}

/** Procvičování: náhodné výpočty ze všech generátorů. */
export function buildCalcPractice(length = 10, only = null) {
  const names = only ?? Object.keys(GEN).filter((n) => n !== 'rod' && n !== 'hzCircle');
  return Array.from({ length }, () => prepare(generate(names[Math.floor(Math.random() * names.length)])));
}

/** Procvičování chyb: otázky, na které uživatel dříve odpověděl špatně. */
export function buildMistakes(mistakes, length = 10) {
  const items = [];
  for (const m of shuffle(mistakes)) {
    const l = lessonById(m.lesson);
    const it = l?.items[m.idx];
    if (it) items.push(prepare(it, { lesson: m.lesson, idx: m.idx }));
    if (items.length >= length) break;
  }
  return items;
}

/** Mix z dokončených lekcí. */
export function buildMix(doneIds, length = 10) {
  const pool = LESSONS.filter((l) => doneIds.includes(l.id));
  const src = pool.length ? pool : LESSONS.slice(0, 3);
  return Array.from({ length }, () => {
    const l = src[Math.floor(Math.random() * src.length)];
    if (l.gens?.length && Math.random() < 0.35) return prepare(generate(l.gens[Math.floor(Math.random() * l.gens.length)]));
    const i = Math.floor(Math.random() * l.items.length);
    return prepare(l.items[i], { lesson: l.id, idx: i });
  });
}

/** Převod textu na číslo (čárka i tečka, mezery, typografické mínus). */
export function parseNumber(text) {
  if (text == null) return NaN;
  const s = String(text).trim().replace(/\s/g, '').replace(/[−–]/g, '-').replace(',', '.');
  if (!/^[-+]?\d*\.?\d+(e[-+]?\d+)?$/i.test(s)) return NaN;
  return Number(s);
}

/** Vyhodnotí odpověď. `answer` je podle typu: text možnosti, boolean, pole kroků, číslo/text. */
export function grade(ex, answer) {
  switch (ex.t) {
    case 'c': return answer === ex.a;
    case 'tf': return answer === ex.a;
    case 'o': return Array.isArray(answer) && answer.length === ex.s.length && answer.every((s, i) => s === ex.s[i]);
    case 'm': return answer === true;
    case 'n': case 'rod': case 'circle': {
      const v = parseNumber(answer);
      return Number.isFinite(v) && Math.abs(v - ex.a) <= ex.tol;
    }
    default: return FIELD_TYPES.includes(ex.t) ? checkField(ex, answer).ok : false;
  }
}

/** Text správné odpovědi pro zpětnou vazbu. */
export function correctText(ex, fmt) {
  switch (ex.t) {
    case 'c': return ex.a;
    case 'tf': return ex.a ? 'Pravda' : 'Nepravda';
    case 'o': return ex.s.map((s, i) => `${i + 1}. ${s}`).join('\n');
    case 'n': case 'rod': case 'circle': return `${fmt(ex.a, ex.dec)} ${ex.unit ?? ''}`.trim();
    default: return '';
  }
}

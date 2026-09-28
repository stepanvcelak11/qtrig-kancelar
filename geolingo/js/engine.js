// Skládání lekcí a hodnocení odpovědí (bez DOM – testovatelné v Node).

import U1 from './content/u01-03.js';
import U2 from './content/u04-06.js';
import U3 from './content/u07-10.js';
import { generate, GEN } from './generators.js';

export const UNITS = [...U1, ...U2, ...U3];
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
  const nGen = gens.length ? Math.min(length - 3, Math.max(2, Math.round(length * (gens.length >= 3 ? 0.5 : 0.35)))) : 0;
  const statics = shuffle(lesson.items.map((it, i) => ({ it, i }))).slice(0, length - nGen);
  const list = statics.map(({ it, i }) => prepare(it, { lesson: lesson.id, idx: i }));
  for (let k = 0; gens.length && list.length < length; k++) {
    list.push(prepare(generate(gens[k % gens.length])));
  }
  return shuffle(list);
}

/** Procvičování: náhodné výpočty ze všech generátorů. */
export function buildCalcPractice(length = 10, only = null) {
  const names = only ?? Object.keys(GEN).filter((n) => n !== 'rod');
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
    case 'n': case 'rod': {
      const v = parseNumber(answer);
      return Number.isFinite(v) && Math.abs(v - ex.a) <= ex.tol;
    }
    default: return false;
  }
}

/** Text správné odpovědi pro zpětnou vazbu. */
export function correctText(ex, fmt) {
  switch (ex.t) {
    case 'c': return ex.a;
    case 'tf': return ex.a ? 'Pravda' : 'Nepravda';
    case 'o': return ex.s.map((s, i) => `${i + 1}. ${s}`).join('\n');
    case 'n': case 'rod': return `${fmt(ex.a, ex.dec)} ${ex.unit ?? ''}`.trim();
    default: return '';
  }
}

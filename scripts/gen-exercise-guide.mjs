#!/usr/bin/env node
/** Generates docs/EXERCISES_HE.md from src/i18n/exerciseInfo.json (the same text shown in the app). */
import { readFileSync, writeFileSync } from 'node:fs';

const info = JSON.parse(readFileSync('src/i18n/exerciseInfo.json', 'utf8'));
const he = readFileSync('src/i18n/he.ts', 'utf8');
const nameBlock = he.slice(he.indexOf('export const EXERCISE_NAME'), he.indexOf('export const EXERCISE_SENTENCE'));
const names = Object.fromEntries([...nameBlock.matchAll(/^\s+(\w+): '([^']+)',$/gm)].map((m) => [m[1], m[2]]));

const order = ['guided_orienting', 'visual_scanning', 'target_search', 'saccadic_exploration', 'focus_initiation', 'alert_then_target', 'leftward_pursuit'];
let md = '# התרגולים — למה, מתי, איך ומתי לא\n\n';
md += 'אותו הסבר מופיע ביישום, תחת ״על התרגול״. זה כלי תרגול בליווי משפחה, לא טיפול מוכח ולא בדיקה. את התאמת התרגולים כדאי לבדוק עם צוות השיקום.\n\n';
md += '<!-- נוצר אוטומטית: node scripts/gen-exercise-guide.mjs — לא לערוך ידנית -->\n';
for (const id of order) {
  const i = info[id];
  md += `\n## ${names[id] ?? id}\n\n**למה.** ${i.why}\n\n**מתי מתאים.** ${i.when}\n\n**איך עושים.** ${i.how}\n\n**מתי לא.** ${i.whenNot}\n`;
}
writeFileSync('docs/EXERCISES_HE.md', md);
console.log('docs/EXERCISES_HE.md written');

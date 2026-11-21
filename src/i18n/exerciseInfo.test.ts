import { readFileSync } from 'node:fs';
import { EXERCISES } from '../domain/exercises';
import type { ExerciseId } from '../domain/types';
import { EXERCISE_INFO } from './exerciseInfo';

describe('exercise explanations', () => {
  it('every exercise has why / when / how / when-not, Hebrew only', () => {
    for (const id of Object.keys(EXERCISES) as ExerciseId[]) {
      const info = EXERCISE_INFO[id];
      for (const k of ['why', 'when', 'how', 'whenNot'] as const) {
        expect(info[k].length).toBeGreaterThan(20);
        expect([id, k, info[k].match(/[A-Za-z]+/g)]).toEqual([id, k, null]);
      }
    }
  });

  it('never claims proven benefit', () => {
    const all = Object.values(EXERCISE_INFO).map((i) => Object.values(i).join(' ')).join(' ');
    expect(all).not.toMatch(/מוכח שעוזר|מרפא|ישפר את/);
  });

  it('docs/EXERCISES_HE.md is in sync with the in-app text', () => {
    const md = readFileSync('docs/EXERCISES_HE.md', 'utf8');
    for (const info of Object.values(EXERCISE_INFO)) for (const t of Object.values(info)) expect(md).toContain(t);
  });
});

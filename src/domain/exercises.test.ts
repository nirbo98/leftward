import { EXERCISES, MAX_DISTRACTORS, SIDE_X } from './exercises';
import type { ExerciseId, StimulusSize } from './types';

describe('stimulus generation in PHYSICAL coordinates', () => {
  it('physical-left target has x < 50 for every exercise that targets left', () => {
    for (const id of ['guided_orienting', 'visual_scanning', 'target_search'] as ExerciseId[]) {
      const p = { ...EXERCISES[id].defaults, targetSide: 'left' as const };
      const spec = EXERCISES[id].generate(p, 0, 1);
      const target = spec.items.find((i) => i.role === 'target')!;
      expect(target.xPct).toBeLessThan(30);
      expect(spec.targetSide).toBe('left');
    }
  });

  it('in scanning, the target is the left-most object', () => {
    const p = { ...EXERCISES.visual_scanning.defaults, distractors: 3, size: 'large' as StimulusSize };
    const spec = EXERCISES.visual_scanning.generate(p, 0, 9);
    const xs = spec.items.map((i) => i.xPct);
    expect(spec.items.find((i) => i.role === 'target')!.xPct).toBe(Math.min(...xs));
  });

  it('distractors are capped so objects remain large and separated', () => {
    for (const size of ['large', 'xlarge', 'huge'] as StimulusSize[]) {
      const spec = EXERCISES.target_search.generate({ ...EXERCISES.target_search.defaults, size, distractors: 99 }, 0, 1);
      expect(spec.items.length).toBe(MAX_DISTRACTORS[size] + 1);
      const xs = spec.items.map((i) => i.xPct).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(14);
    }
  });

  it('target search uses a distinct target glyph', () => {
    const spec = EXERCISES.target_search.generate(EXERCISES.target_search.defaults, 0, 3);
    const t = spec.items.find((i) => i.role === 'target')!;
    expect(spec.items.filter((i) => i.role === 'distractor').every((d) => d.glyph !== t.glyph)).toBe(true);
  });

  it('generation is deterministic for a seed', () => {
    const p = EXERCISES.target_search.defaults;
    expect(EXERCISES.target_search.generate(p, 2, 77)).toEqual(EXERCISES.target_search.generate(p, 2, 77));
  });

  it('saccadic relocation alternates physical sides and favours the left', () => {
    const sides = [0, 1, 2, 3, 4, 5].map((i) => EXERCISES.saccadic_exploration.generate(EXERCISES.saccadic_exploration.defaults, i, 1).targetSide);
    expect(sides.filter((s) => s === 'left').length).toBeGreaterThanOrEqual(3);
    expect(new Set(sides).size).toBeGreaterThan(1);
  });

  it('slow pursuit starts physically right and is destined for the physical left', () => {
    const spec = EXERCISES.saccadic_exploration.generate({ ...EXERCISES.saccadic_exploration.defaults, motion: 'slow_pursuit' }, 0, 1);
    expect(spec.items[0]!.xPct).toBe(SIDE_X.right);
    expect(spec.targetSide).toBe('left');
  });

  it('photo theme without photos falls back to a simple shape', () => {
    const spec = EXERCISES.guided_orienting.generate({ ...EXERCISES.guided_orienting.defaults, theme: 'photos', photoIds: [] }, 0, 1);
    expect(spec.items[0]!.glyph).toBe('disc');
  });
});

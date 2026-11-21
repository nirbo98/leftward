import { applyChange, recommendNextStep, recommendStart, type AdaptContext, type ParamChange } from './adaptive';
import { EXERCISES } from './exercises';
import type { SessionRecord, TrialParams } from './types';
import { cue, NONE, trial } from '../test/fixtures';

const base = (p: Partial<TrialParams> = {}, exercise: AdaptContext['exercise'] = 'guided_orienting'): AdaptContext => ({
  readiness: 'alert',
  vision: { preview: 'noticed', glasses: 'wearing' },
  exercise,
  params: { ...EXERCISES[exercise].defaults, ...p },
});

function changedVariables(c: ParamChange): number {
  return c.variable === 'none' ? 0 : 1;
}

describe('adaptive engine (acceptance 5)', () => {
  it('three comparable unaided leftward orientations → exactly one less-assisted step', () => {
    const t = [trial({}), trial({}), trial({})];
    const r = recommendNextStep(base(), t);
    expect(r.kind).toBe('try_sparse_scanning');
    expect(r.increasesDemand).toBe(true);
    expect(changedVariables(r.change)).toBe(1);
  });

  it('with a start cue, the less-assisted step removes only that cue', () => {
    const p = { startCue: 'visual' as const };
    const t = [trial({ params: p, cues: [cue('visual')], flags: {} }), trial({ params: p }), trial({ params: p })].map((x) => ({ ...x, responseClass: 'spontaneous' as const }));
    const r = recommendNextStep(base(p), t);
    expect(r.change).toEqual({ variable: 'startCue', from: 'visual', to: 'none' });
  });

  it('scanning: adds ONE distractor, never several dimensions', () => {
    const ctx = base({}, 'visual_scanning');
    const t = [1, 2, 3].map(() => trial({ exercise: 'visual_scanning' }));
    const r = recommendNextStep(ctx, t);
    expect(r.change).toEqual({ variable: 'distractors', from: 1, to: 2 });
    const next = applyChange(ctx.exercise, ctx.params, r.change);
    const diff = (Object.keys(next.params) as (keyof TrialParams)[]).filter((k) => JSON.stringify(next.params[k]) !== JSON.stringify(ctx.params[k]));
    expect(diff).toEqual(['distractors']);
  });

  it('two cue-dependent comparable observations → maintain cue, no escalation', () => {
    const t = [trial({ cues: [cue('visual')] }), trial({ cues: [cue('visual')] })];
    const r = recommendNextStep(base(), t);
    expect(r.kind).toBe('maintain_cue');
    expect(r.increasesDemand).toBe(false);
  });

  it('never increases difficulty on a tired day', () => {
    const t = [trial({}), trial({}), trial({})];
    const r = recommendNextStep({ ...base(), readiness: 'tired' }, t);
    expect(r.increasesDemand).toBe(false);
  });

  it('never increases difficulty when vision is uncertain', () => {
    const t = [trial({}), trial({}), trial({})];
    for (const preview of ['unclear', 'not_noticed'] as const) {
      expect(recommendNextStep({ ...base(), vision: { preview, glasses: 'not_available' } }, t).increasesDemand).toBe(false);
    }
  });

  it('fatigue flag → rest (not labelled as worsening)', () => {
    const t = [trial({}), trial({}), trial({ flags: { fatigue: true } })];
    const r = recommendNextStep(base(), t);
    expect(r.kind).toBe('rest');
    expect(r.rationaleHe).not.toMatch(/החמר(ה|ת)\b(?!.*לא)/);
    expect(r.rationaleHe).toContain('לא סימן להחמרה');
  });

  it('discomfort → stop', () => {
    expect(recommendNextStep(base(), [trial({ flags: { discomfort: true } })]).kind).toBe('stop');
  });

  it('multiple uncertain outcomes → simplify or rest, never escalate', () => {
    const unc = { kind: 'cannot_determine', reason: 'uncertain' } as const;
    const r1 = recommendNextStep(base({ theme: 'cars' }), [trial({ params: { theme: 'cars' }, outcome: unc }), trial({ params: { theme: 'cars' }, outcome: unc })]);
    expect(r1.kind).toBe('switch_to_shape');
    const r2 = recommendNextStep(base(), [trial({ outcome: unc }), trial({ outcome: unc })]);
    expect(r2.kind).toBe('rest');
    expect(r1.increasesDemand || r2.increasesDemand).toBe(false);
  });

  it('poor visibility with a personal photo → switch to a simple shape', () => {
    const r = recommendNextStep(base({ theme: 'photos', photoIds: ['p'] }), [trial({ params: { theme: 'photos', photoIds: ['p'] }, flags: { poorVisibility: true } })]);
    expect(r.change).toEqual({ variable: 'theme', from: 'photos', to: 'shapes' });
  });

  it('two "no response" → strengthen support by one step only', () => {
    const r = recommendNextStep(base({ size: 'xlarge' }), [trial({ params: { size: 'xlarge' }, outcome: NONE }), trial({ params: { size: 'xlarge' }, outcome: NONE })]);
    expect(r.change).toEqual({ variable: 'size', from: 'xlarge', to: 'huge' });
    expect(r.increasesDemand).toBe(false);
  });

  it('comparability guard: different configurations are not pooled', () => {
    const t = [trial({ params: { size: 'large' } }), trial({}), trial({})];
    const r = recommendNextStep(base(), t);
    expect(r.basis.comparableTrials).toBe(2);
    expect(r.increasesDemand).toBe(false);
  });

  it('right-side or centre targets never trigger leftward escalation', () => {
    const t = [1, 2, 3].map(() => trial({ params: { targetSide: 'right' } }));
    expect(recommendNextStep(base({ targetSide: 'right' }), t).increasesDemand).toBe(false);
  });

  it('name used three trials in a row → suggest one uncued trial (habituation guard)', () => {
    const t = [1, 2, 3].map(() => trial({ cues: [cue('nickname')] }));
    expect(recommendNextStep(base(), t).kind).toBe('add_unprompted_trial');
  });

  it('dismissed suggestions are not repeated', () => {
    const t = [trial({ cues: [cue('visual')] }), trial({ cues: [cue('visual')] })];
    expect(recommendNextStep({ ...base(), dismissed: ['maintain_cue'] }, t).kind).toBe('continue_same');
  });

  it('is deterministic', () => {
    const t = [trial({}), trial({ outcome: NONE }), trial({})];
    expect(recommendNextStep(base(), t)).toEqual(recommendNextStep(base(), t));
  });
});

describe('session start suggestion', () => {
  const goodDay: SessionRecord = { id: 'prev', startedAt: 1, deviceClass: 'desktop', readiness: 'alert', vision: { preview: 'noticed', glasses: 'wearing' }, plannedExercise: 'guided_orienting', pauseCount: 0 };
  const goodTrials = [1, 2, 3, 4].map(() => trial({ sessionId: 'prev' }));
  const args = { deviceClass: 'desktop' as const, preferredTheme: 'cars' as const, photoIds: [], history: { sessions: [goodDay], trials: goodTrials } };

  it('a new tired day overrides a previously good day', () => {
    const r = recommendStart({ ...args, readiness: 'tired', vision: { preview: 'noticed', glasses: 'wearing' } });
    expect(r.exercise).toBe('guided_orienting');
    expect(r.params.size).toBe('huge');
    expect(r.params.theme).toBe('shapes');
    expect(r.provisionalFromHistory).toBe(false);
  });

  it('alert day may provisionally use history from the same device', () => {
    const r = recommendStart({ ...args, readiness: 'alert', vision: { preview: 'noticed', glasses: 'wearing' } });
    expect(r.exercise).toBe('visual_scanning');
    expect(r.provisionalFromHistory).toBe(true);
  });

  it('history from another device is not used', () => {
    const r = recommendStart({ ...args, deviceClass: 'tablet-landscape', readiness: 'alert', vision: { preview: 'noticed', glasses: 'wearing' } });
    expect(r.exercise).toBe('guided_orienting');
  });

  it('no glasses / unclear vision → large simple shape regardless of interests', () => {
    const r = recommendStart({ ...args, readiness: 'alert', vision: { preview: 'skipped', glasses: 'not_available' } });
    expect(r.params.theme).toBe('shapes');
    expect(r.params.size).toBe('huge');
  });

  it('not fit → no training', () => {
    expect(recommendStart({ ...args, readiness: 'not_fit', vision: { preview: 'skipped', glasses: 'not_recorded' } }).kind).toBe('no_training');
  });
});

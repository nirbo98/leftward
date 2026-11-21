import { EXERCISES } from './exercises';
import { initRunner, runnerReducer, type RunnerState } from './runner';
import type { ExerciseId } from './types';
import { NONE, obs, ORIENT_EYES } from '../test/fixtures';

const start = (exercise: ExerciseId = 'guided_orienting') => initRunner({ sessionId: 's', exercise, seed: 42, soundEnabled: false });
const go = (s: RunnerState, ...as: Parameters<typeof runnerReducer>[1][]) => as.reduce(runnerReducer, s);

describe('runner (shared session/response API)', () => {
  it('preserves cue order and provenance across multiple cues', () => {
    let s = go(start(), { type: 'START_TRIAL', now: 1000 });
    s = go(
      s,
      { type: 'ADD_CUE', id: 'a', now: 2000, cue: { type: 'visual', delivery: 'on_screen', side: 'left', validity: 'valid' } },
      { type: 'ADD_CUE', id: 'b', now: 3000, cue: { type: 'first_name', delivery: 'caregiver_spoken', validity: 'not_applicable' } },
      { type: 'ADD_CUE', id: 'c', now: 4000, cue: { type: 'first_name', delivery: 'caregiver_spoken', validity: 'not_applicable' } },
      { type: 'OPEN_OBSERVATION' },
      { type: 'RECORD', id: 'r1', observation: obs(ORIENT_EYES) },
    );
    const rec = s.completed[0]!;
    expect(rec.cues.map((c) => [c.order, c.type])).toEqual([[1, 'visual'], [2, 'first_name'], [3, 'first_name']]);
    expect(rec.cues.map((c) => c.tMs)).toEqual([1000, 2000, 3000]);
    expect(rec.responseClass).toBe('after_spatial_cue');
    expect(rec.cues.filter((c) => c.type === 'first_name')).toHaveLength(2); // repeated calls are not merged
  });

  it('a start-of-trial visual cue is logged, so such a trial is never uncued', () => {
    let s = start();
    s = go(s, { type: 'SET_PARAMS', params: { ...s.params, startCue: 'visual' } }, { type: 'START_TRIAL', now: 0 }, { type: 'RECORD', id: 'r', observation: obs(ORIENT_EYES) });
    expect(s.completed[0]!.cues[0]).toMatchObject({ order: 1, type: 'visual', delivery: 'on_screen' });
    expect(s.completed[0]!.responseClass).toBe('after_spatial_cue');
  });

  it('undo removes the last cue, then the last record (restoring the trial for re-recording)', () => {
    let s = go(start(), { type: 'START_TRIAL', now: 0 }, { type: 'ADD_CUE', id: 'a', now: 1, cue: { type: 'other', delivery: 'caregiver_other', validity: 'not_applicable' } });
    s = go(s, { type: 'UNDO' });
    expect(s.cues).toHaveLength(0);
    s = go(s, { type: 'RECORD', id: 'r', observation: obs(NONE) });
    expect(s.completed).toHaveLength(1);
    s = go(s, { type: 'UNDO' });
    expect(s.completed).toHaveLength(0);
    expect(s.phase).toBe('observing');
    expect(s.lastUndoneRecordId).toBe('r');
    s = go(s, { type: 'RECORD', id: 'r2', observation: obs(ORIENT_EYES) });
    expect(s.completed.map((r) => r.id)).toEqual(['r2']);
  });

  it('pause is available from any phase and blocks progress until resumed', () => {
    for (const pre of [[], [{ type: 'START_TRIAL', now: 0 }], [{ type: 'START_TRIAL', now: 0 }, { type: 'OPEN_OBSERVATION' }]] as const) {
      let s = go(start(), ...(pre as unknown as never[]));
      const before = s.phase;
      s = go(s, { type: 'PAUSE' });
      expect(s.phase).toBe('paused');
      expect(go(s, { type: 'START_TRIAL', now: 5 })).toBe(s);
      s = go(s, { type: 'RESUME' });
      expect(s.phase).toBe(before);
    }
  });

  it('repeat restarts the trial without previous cues', () => {
    let s = go(start(), { type: 'START_TRIAL', now: 0 }, { type: 'ADD_CUE', id: 'a', now: 1, cue: { type: 'other', delivery: 'caregiver_other', validity: 'not_applicable' } });
    s = go(s, { type: 'REPEAT_TRIAL', now: 10 });
    expect(s.cues).toEqual([]);
    expect(s.trialStartedAt).toBe(10);
  });

  it('every exercise runs a true working loop through the same API (acceptance 9)', () => {
    for (const id of Object.keys(EXERCISES) as ExerciseId[]) {
      let s = start(id);
      for (let i = 0; i < 4; i++) s = go(s, { type: 'START_TRIAL', now: i }, { type: 'REVEAL_TARGET', now: i }, { type: 'OPEN_OBSERVATION' }, { type: 'RECORD', id: `${id}${i}`, observation: obs(i % 2 ? ORIENT_EYES : NONE) });
      expect(s.completed).toHaveLength(4);
      expect(s.completed.every((r) => r.exercise === id && r.itemCount >= 1)).toBe(true);
    }
  });

  it('a session can be finished with only caregiver actions (no patient input exists in the API)', () => {
    const s = go(start(), { type: 'START_TRIAL', now: 0 }, { type: 'OPEN_OBSERVATION' }, { type: 'RECORD', id: 'r', observation: obs({ kind: 'cannot_determine', reason: 'fatigue' }) });
    expect(s.completed[0]!.responseClass).toBe('cannot_determine');
  });
});

describe('alert-then-target pre-target phase', () => {
  it('cues before reveal are flagged preTarget, target onset recorded, observation only after reveal', () => {
    let s = go(start('alert_then_target'), { type: 'START_TRIAL', now: 1000 });
    expect(s.phase).toBe('pre_target');
    s = go(s, { type: 'OPEN_OBSERVATION' });
    expect(s.phase).toBe('pre_target');
    s = go(s, { type: 'ADD_CUE', id: 'a', now: 1500, cue: { type: 'first_name', delivery: 'caregiver_spoken', validity: 'not_applicable' } });
    s = go(s, { type: 'REVEAL_TARGET', now: 2500 });
    expect(s.phase).toBe('stimulus');
    s = go(s, { type: 'ADD_CUE', id: 'b', now: 4000, cue: { type: 'visual', delivery: 'on_screen', side: 'left', validity: 'valid' } });
    s = go(s, { type: 'OPEN_OBSERVATION' }, { type: 'RECORD', id: 'r', observation: obs(ORIENT_EYES) });
    const r = s.completed[0]!;
    expect(r.cues.map((c) => [c.type, !!c.preTarget])).toEqual([['first_name', true], ['visual', false]]);
    expect(r.targetOnsetMs).toBe(1500);
    expect(r.responseClass).toBe('after_spatial_cue');
  });

  it('alert-only trial is after a NON-spatial cue, never spontaneous', () => {
    const s = go(
      start('alert_then_target'),
      { type: 'START_TRIAL', now: 0 },
      { type: 'ADD_CUE', id: 'a', now: 1, cue: { type: 'verbal_alert', delivery: 'caregiver_spoken', validity: 'not_applicable' } },
      { type: 'REVEAL_TARGET', now: 2 },
      { type: 'RECORD', id: 'r', observation: obs(ORIENT_EYES) },
    );
    expect(s.completed[0]!.responseClass).toBe('after_nonspatial_cue');
  });

  it('pause during the pre-target phase resumes to it', () => {
    let s = go(start('alert_then_target'), { type: 'START_TRIAL', now: 0 }, { type: 'PAUSE' });
    s = go(s, { type: 'RESUME' });
    expect(s.phase).toBe('pre_target');
  });
});

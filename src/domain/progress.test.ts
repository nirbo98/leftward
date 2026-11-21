import { summarize } from './progress';
import type { SessionRecord } from './types';
import { cue, NONE, trial } from '../test/fixtures';

const s: SessionRecord = { id: 's1', startedAt: 1, deviceClass: 'desktop', readiness: 'tired', vision: { preview: 'noticed', glasses: 'not_recorded' }, plannedExercise: 'guided_orienting', pauseCount: 0 };

describe('descriptive progress', () => {
  it('reports counts with denominators that exclude cannot-determine, but shows them', () => {
    const t = [
      trial({}),
      trial({ cues: [cue('visual')] }),
      trial({ outcome: NONE }),
      trial({ outcome: { kind: 'cannot_determine', reason: 'fatigue' } }),
    ];
    const p = summarize([s], t);
    expect(p.leftTargets).toMatchObject({ total: 4, interpretable: 3, spontaneous: 1, afterSpatialCue: 1, noResponse: 1, cannotDetermine: 1 });
    expect(p.fatigueFlagged).toBe(1);
    expect(p.smallSample).toBe(true);
    expect(p.byReadiness.tired!.total).toBe(4);
  });

  it('describes cue use and first-cue patterns without any statistic', () => {
    const p = summarize([s], [trial({ cues: [cue('nickname')] }), trial({ cues: [cue('first_name')], outcome: NONE })]);
    expect(p.byFirstCue.nickname).toEqual({ trials: 1, orientedAfter: 1, interpretable: 1 });
    expect(p.byFirstCue.first_name).toEqual({ trials: 1, orientedAfter: 0, interpretable: 1 });
    expect(Object.keys(p)).not.toContain('pValue');
  });
});

describe('alert comparison (descriptive)', () => {
  it('separates pure pre-target alert trials, no-cue trials, and excludes mixed trials', () => {
    const pre = (type: Parameters<typeof cue>[0]) => cue(type, 1, { preTarget: true });
    const t = [
      trial({ exercise: 'alert_then_target', cues: [pre('first_name')] }),
      trial({ exercise: 'alert_then_target', cues: [pre('verbal_alert')], outcome: NONE }),
      trial({ exercise: 'alert_then_target' }),
      trial({ exercise: 'alert_then_target', cues: [pre('first_name'), cue('visual', 2)] }),
    ];
    const a = summarize([s], t).alertComparison;
    expect(a.withAlert).toEqual({ trials: 2, interpretable: 2, oriented: 1 });
    expect(a.withoutAlert).toEqual({ trials: 1, interpretable: 1, oriented: 1 });
    expect(a.excludedMixed).toBe(1);
  });
});

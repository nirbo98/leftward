/**
 * Descriptive progress summaries. Counts with denominators only — no scores,
 * percentages of "improvement", norms, or clinical interpretation.
 */
import { cueSpatiality } from './observation';
import type { CueType, DeviceClass, ExerciseId, Readiness, ResponseClass, SessionRecord, TrialRecord } from './types';

export interface ClassCounts {
  total: number;
  interpretable: number;
  spontaneous: number;
  afterSpatialCue: number;
  afterNonspatialCue: number;
  otherDirection: number;
  noResponse: number;
  cannotDetermine: number;
}

export function emptyCounts(): ClassCounts {
  return { total: 0, interpretable: 0, spontaneous: 0, afterSpatialCue: 0, afterNonspatialCue: 0, otherDirection: 0, noResponse: 0, cannotDetermine: 0 };
}

const FIELD: Record<ResponseClass, keyof ClassCounts> = {
  spontaneous: 'spontaneous',
  after_spatial_cue: 'afterSpatialCue',
  after_nonspatial_cue: 'afterNonspatialCue',
  other_direction: 'otherDirection',
  no_response_observed: 'noResponse',
  cannot_determine: 'cannotDetermine',
};

export function countClasses(trials: readonly TrialRecord[]): ClassCounts {
  const c = emptyCounts();
  for (const t of trials) {
    c.total++;
    c[FIELD[t.responseClass]]++;
    if (t.responseClass !== 'cannot_determine') c.interpretable++;
  }
  return c;
}

export interface ProgressSummary {
  sessionCount: number;
  trialCount: number;
  /** Only trials whose target was on the physical left. */
  leftTargets: ClassCounts;
  byExercise: Partial<Record<ExerciseId, ClassCounts>>;
  byReadiness: Partial<Record<Readiness, ClassCounts>>;
  byDevice: Partial<Record<DeviceClass, ClassCounts>>;
  cueUse: Partial<Record<CueType, number>>;
  trialsWithoutAnyCue: number;
  /** Descriptive cue-type comparison (tiny-N warnings are shown in UI). */
  byFirstCue: Partial<Record<CueType, { trials: number; orientedAfter: number; interpretable: number }>>;
  fatigueFlagged: number;
  smallSample: boolean;
  /**
   * Alert-then-target exercise, descriptive only: trials with ONLY pre-target non-spatial alerts
   * vs trials with no cue at all. Trials with any cue after the target are excluded ("mixed").
   */
  alertComparison: {
    withAlert: { trials: number; interpretable: number; oriented: number };
    withoutAlert: { trials: number; interpretable: number; oriented: number };
    excludedMixed: number;
  };
}

export const SMALL_SAMPLE = 20;

export function summarize(sessions: readonly SessionRecord[], trials: readonly TrialRecord[]): ProgressSummary {
  const sessionById = new Map(sessions.map((s) => [s.id, s]));
  const group = <K extends string>(key: (t: TrialRecord) => K | undefined) => {
    const m: Partial<Record<K, TrialRecord[]>> = {};
    for (const t of trials) {
      const k = key(t);
      if (!k) continue;
      (m[k] ??= []).push(t);
    }
    const out: Partial<Record<K, ClassCounts>> = {};
    for (const k of Object.keys(m) as K[]) out[k] = countClasses(m[k]!);
    return out;
  };
  const cueUse: Partial<Record<CueType, number>> = {};
  const byFirstCue: ProgressSummary['byFirstCue'] = {};
  let noCue = 0;
  for (const t of trials) {
    if (t.cues.length === 0) noCue++;
    for (const c of t.cues) cueUse[c.type] = (cueUse[c.type] ?? 0) + 1;
    const first = t.cues[0];
    if (first) {
      const e = (byFirstCue[first.type] ??= { trials: 0, orientedAfter: 0, interpretable: 0 });
      e.trials++;
      if (t.responseClass !== 'cannot_determine') e.interpretable++;
      if (t.responseClass === 'after_spatial_cue' || t.responseClass === 'after_nonspatial_cue') e.orientedAfter++;
    }
  }
  const alertComparison: ProgressSummary['alertComparison'] = {
    withAlert: { trials: 0, interpretable: 0, oriented: 0 },
    withoutAlert: { trials: 0, interpretable: 0, oriented: 0 },
    excludedMixed: 0,
  };
  for (const t of trials.filter((x) => x.exercise === 'alert_then_target')) {
    const pure = t.cues.every((c) => c.preTarget && cueSpatiality(c.type) === 'nonspatial');
    if (!pure) {
      alertComparison.excludedMixed++;
      continue;
    }
    const bucket = t.cues.length > 0 ? alertComparison.withAlert : alertComparison.withoutAlert;
    bucket.trials++;
    if (t.responseClass !== 'cannot_determine') bucket.interpretable++;
    if (t.responseClass === 'spontaneous' || t.responseClass === 'after_nonspatial_cue') bucket.oriented++;
  }
  return {
    alertComparison,
    sessionCount: sessions.length,
    trialCount: trials.length,
    leftTargets: countClasses(trials.filter((t) => t.targetSide === 'left')),
    byExercise: group((t) => t.exercise),
    byReadiness: group((t) => sessionById.get(t.sessionId)?.readiness),
    byDevice: group((t) => sessionById.get(t.sessionId)?.deviceClass),
    cueUse,
    trialsWithoutAnyCue: noCue,
    byFirstCue,
    fatigueFlagged: trials.filter((t) => t.observation.flags.fatigue || (t.observation.outcome.kind === 'cannot_determine' && t.observation.outcome.reason === 'fatigue')).length,
    smallSample: trials.length < SMALL_SAMPLE,
  };
}

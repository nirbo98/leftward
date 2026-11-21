import type {
  CueEvent,
  CueSpatiality,
  CueType,
  Observation,
  ResponseClass,
  ResponseTiming,
} from './types';

/** Spatial information carried by each cue type. Name-only cues are alerting, not spatial. */
export function cueSpatiality(type: CueType): CueSpatiality {
  switch (type) {
    case 'visual':
    case 'verbal_left':
    case 'name_plus_left':
      return 'spatial';
    case 'neutral_tone':
    case 'verbal_alert':
    case 'first_name':
    case 'nickname':
      return 'nonspatial';
    case 'other':
      return 'unknown';
  }
}

export function isPersonalCue(type: CueType): boolean {
  return type === 'first_name' || type === 'nickname' || type === 'name_plus_left';
}

/**
 * Timing relative to cues. If any cue was given, the response is "after cue"
 * unless the caregiver explicitly asserted it happened before the first cue.
 */
export function responseTiming(cues: readonly CueEvent[], obs: Observation): ResponseTiming {
  if (cues.length === 0) return 'no_cues_given';
  return obs.caregiverSaysBeforeFirstCue ? 'before_first_cue' : 'after_cue';
}

/**
 * Deterministic, explainable classification of a caregiver observation.
 * - Only an orientation toward the target with no preceding cue is "spontaneous".
 * - Fatigue / uncertainty / visibility always map to "cannot_determine".
 * - A fatigue flag downgrades any outcome to cannot_determine for interpretation.
 */
export function classifyObservation(cues: readonly CueEvent[], obs: Observation): ResponseClass {
  const o = obs.outcome;
  if (o.kind === 'cannot_determine') return 'cannot_determine';
  if (obs.flags.fatigue || obs.flags.poorVisibility) return 'cannot_determine';
  if (o.kind === 'no_response_observed') return 'no_response_observed';
  if (o.kind === 'other_direction') return 'other_direction';
  if (o.modality === 'unclear_kind') return 'cannot_determine';

  const timing = responseTiming(cues, obs);
  if (timing !== 'after_cue') return 'spontaneous';
  const anySpatial = cues.some((c) => cueSpatiality(c.type) !== 'nonspatial');
  return anySpatial ? 'after_spatial_cue' : 'after_nonspatial_cue';
}

/** Interpretable = an outcome the caregiver could actually judge (not fatigue/uncertain). */
export function isInterpretable(rc: ResponseClass): boolean {
  return rc !== 'cannot_determine';
}

export function isCueDependent(rc: ResponseClass): boolean {
  return rc === 'after_spatial_cue' || rc === 'after_nonspatial_cue';
}

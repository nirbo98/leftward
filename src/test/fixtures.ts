/**
 * Test fixtures. ALL data here is fictional and non-identifying.
 * The placeholder "בדיקה" (Hebrew for "test") is used wherever a name is needed.
 */
import { EXERCISES } from '../domain/exercises';
import { classifyObservation, responseTiming } from '../domain/observation';
import type { CueEvent, ExerciseId, Observation, ObservationFlags, ObservationOutcome, PhysicalSide, TrialParams, TrialRecord } from '../domain/types';
import { NO_FLAGS } from '../domain/types';

export const FAKE_NAME = 'בדיקה';
export const FAKE_NICK = 'בדיקון';

export function obs(outcome: ObservationOutcome, extra: Partial<Observation> = {}): Observation {
  return {
    outcome,
    caregiverSaysBeforeFirstCue: false,
    identification: 'not_recorded',
    flags: NO_FLAGS,
    caregiverMarkedObjectIds: [],
    recordedAt: 0,
    ...extra,
  };
}

export const ORIENT_EYES: ObservationOutcome = { kind: 'oriented', modality: 'eyes' };
export const NONE: ObservationOutcome = { kind: 'no_response_observed' };

export function cue(type: CueEvent['type'], order = 1, extra: Partial<CueEvent> = {}): CueEvent {
  return { id: `c${order}`, order, type, delivery: 'caregiver_spoken', validity: 'not_applicable', tMs: order * 1000, ...extra };
}

let seq = 0;
export function trial(args: {
  exercise?: ExerciseId;
  params?: Partial<TrialParams>;
  cues?: CueEvent[];
  outcome?: ObservationOutcome;
  flags?: Partial<ObservationFlags>;
  targetSide?: PhysicalSide;
  sessionId?: string;
}): TrialRecord {
  const exercise = args.exercise ?? 'guided_orienting';
  const params = { ...EXERCISES[exercise].defaults, ...(args.params ?? {}) };
  const cues = args.cues ?? [];
  const o = obs(args.outcome ?? ORIENT_EYES, { flags: { ...NO_FLAGS, ...(args.flags ?? {}) } });
  seq++;
  return {
    id: 't' + seq,
    sessionId: args.sessionId ?? 's1',
    index: seq,
    exercise,
    startedAt: seq,
    params,
    targetSide: args.targetSide ?? params.targetSide,
    itemCount: 1,
    cues,
    observation: o,
    responseClass: classifyObservation(cues, o),
    timing: responseTiming(cues, o),
    soundEnabled: false,
  };
}

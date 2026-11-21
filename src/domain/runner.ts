import { classifyObservation, responseTiming } from './observation';
import { EXERCISES } from './exercises';
import type { CueEvent, ExerciseId, Observation, TrialParams, TrialRecord, TrialSpec } from './types';

/**
 * Pure state machine shared by every exercise. No timers decide outcomes:
 * the caregiver advances trials, adds cues and records observations.
 */
export type RunnerPhase = 'between' | 'pre_target' | 'stimulus' | 'observing' | 'paused';

type UndoEntry =
  | { kind: 'cue' }
  | { kind: 'record'; spec: TrialSpec; cues: CueEvent[]; startedAt: number; shownAt: number | null; recordId: string };

export interface RunnerState {
  sessionId: string;
  exercise: ExerciseId;
  params: TrialParams;
  seed: number;
  phase: RunnerPhase;
  pausedFrom: Exclude<RunnerPhase, 'paused'> | null;
  trial: TrialSpec | null;
  trialStartedAt: number;
  /** Set when the target becomes visible in a pre-target-phase exercise. */
  targetShownAt: number | null;
  cues: CueEvent[];
  completed: TrialRecord[];
  nextIndex: number;
  undo: UndoEntry[];
  soundEnabled: boolean;
  /** Id of the record removed by the most recent undo (so storage can delete it). */
  lastUndoneRecordId: string | null;
}

export type NewCue = Omit<CueEvent, 'id' | 'order' | 'tMs'>;

export type RunnerAction =
  | { type: 'START_TRIAL'; now: number }
  | { type: 'ADD_CUE'; cue: NewCue; id: string; now: number }
  | { type: 'REVEAL_TARGET'; now: number }
  | { type: 'OPEN_OBSERVATION' }
  | { type: 'CLOSE_OBSERVATION' }
  | { type: 'RECORD'; observation: Observation; id: string }
  | { type: 'UNDO' }
  | { type: 'PAUSE' }
  | { type: 'RESUME' }
  | { type: 'REPEAT_TRIAL'; now: number }
  | { type: 'SET_PARAMS'; params: TrialParams }
  | { type: 'SET_EXERCISE'; exercise: ExerciseId; params?: TrialParams }
  | { type: 'SET_SOUND'; enabled: boolean };

export function initRunner(args: {
  sessionId: string;
  exercise: ExerciseId;
  params?: TrialParams;
  seed: number;
  soundEnabled: boolean;
}): RunnerState {
  return {
    sessionId: args.sessionId,
    exercise: args.exercise,
    params: args.params ?? { ...EXERCISES[args.exercise].defaults },
    seed: args.seed,
    phase: 'between',
    pausedFrom: null,
    trial: null,
    trialStartedAt: 0,
    targetShownAt: null,
    cues: [],
    completed: [],
    nextIndex: 0,
    undo: [],
    soundEnabled: args.soundEnabled,
    lastUndoneRecordId: null,
  };
}

/** A visual cue configured to appear at trial start is logged as cue #1 — such a trial is never "uncued". */
function startCues(state: RunnerState, spec: TrialSpec): CueEvent[] {
  if (spec.params.startCue !== 'visual') return [];
  return [
    {
      id: `${state.sessionId}-t${spec.index}-start`,
      order: 1,
      type: 'visual',
      delivery: 'on_screen',
      side: spec.targetSide,
      validity: 'valid',
      tMs: 0,
    },
  ];
}

export function runnerReducer(state: RunnerState, action: RunnerAction): RunnerState {
  const s = { ...state, lastUndoneRecordId: null };
  switch (action.type) {
    case 'START_TRIAL': {
      if (state.phase === 'paused') return state;
      const def = EXERCISES[state.exercise];
      const spec = def.generate(state.params, state.nextIndex, state.seed);
      return {
        ...s,
        phase: def.preTargetPhase ? 'pre_target' : 'stimulus',
        trial: spec,
        trialStartedAt: action.now,
        targetShownAt: def.preTargetPhase ? null : action.now,
        cues: startCues(state, spec),
        nextIndex: state.nextIndex + 1,
        undo: state.undo.filter((u) => u.kind === 'record'),
      };
    }
    case 'ADD_CUE': {
      if (!state.trial || state.phase === 'paused' || state.phase === 'between') return state;
      const cue: CueEvent = {
        ...action.cue,
        id: action.id,
        order: state.cues.length + 1,
        tMs: Math.max(0, action.now - state.trialStartedAt),
        ...(state.phase === 'pre_target' ? { preTarget: true } : {}),
      };
      return { ...s, cues: [...state.cues, cue], undo: [...state.undo, { kind: 'cue' }] };
    }
    case 'REVEAL_TARGET':
      if (state.phase !== 'pre_target') return state;
      return { ...s, phase: 'stimulus', targetShownAt: action.now };
    case 'OPEN_OBSERVATION':
      if (!state.trial || state.phase !== 'stimulus') return state;
      return { ...s, phase: 'observing' };
    case 'CLOSE_OBSERVATION':
      if (state.phase !== 'observing') return state;
      return { ...s, phase: 'stimulus' };
    case 'RECORD': {
      if (!state.trial || (state.phase !== 'observing' && state.phase !== 'stimulus')) return state;
      const rec: TrialRecord = {
        id: action.id,
        sessionId: state.sessionId,
        index: state.trial.index,
        exercise: state.exercise,
        startedAt: state.trialStartedAt,
        params: state.trial.params,
        targetSide: state.trial.targetSide,
        itemCount: state.trial.items.length,
        cues: state.cues,
        observation: action.observation,
        responseClass: classifyObservation(state.cues, action.observation),
        timing: responseTiming(state.cues, action.observation),
        soundEnabled: state.soundEnabled,
        ...(EXERCISES[state.exercise].preTargetPhase && state.targetShownAt !== null
          ? { targetOnsetMs: Math.max(0, state.targetShownAt - state.trialStartedAt) }
          : {}),
      };
      return {
        ...s,
        phase: 'between',
        completed: [...state.completed, rec],
        undo: [
          ...state.undo.filter((u) => u.kind === 'record'),
          { kind: 'record', spec: state.trial, cues: state.cues, startedAt: state.trialStartedAt, shownAt: state.targetShownAt, recordId: rec.id },
        ],
        trial: null,
        cues: [],
      };
    }
    case 'UNDO': {
      if (state.phase === 'paused') return state;
      const last = state.undo[state.undo.length - 1];
      if (!last) return state;
      const undo = state.undo.slice(0, -1);
      if (last.kind === 'cue') {
        if (!state.trial || state.phase === 'between') return { ...s, undo };
        return { ...s, cues: state.cues.slice(0, -1), undo };
      }
      // Undo a recorded observation: only from "between" (no newer trial running).
      if (state.phase !== 'between') return state;
      return {
        ...s,
        phase: 'observing',
        trial: last.spec,
        cues: last.cues,
        trialStartedAt: last.startedAt,
        targetShownAt: last.shownAt,
        completed: state.completed.filter((r) => r.id !== last.recordId),
        undo,
        lastUndoneRecordId: last.recordId,
      };
    }
    case 'PAUSE':
      if (state.phase === 'paused') return state;
      return { ...s, phase: 'paused', pausedFrom: state.phase };
    case 'RESUME':
      if (state.phase !== 'paused') return state;
      return { ...s, phase: state.pausedFrom ?? 'between', pausedFrom: null };
    case 'REPEAT_TRIAL':
      if (!state.trial || state.phase === 'paused') return state;
      return {
        ...s,
        phase: EXERCISES[state.exercise].preTargetPhase ? 'pre_target' : 'stimulus',
        targetShownAt: EXERCISES[state.exercise].preTargetPhase ? null : action.now,
        cues: startCues(state, state.trial),
        trialStartedAt: action.now,
        undo: state.undo.filter((u) => u.kind === 'record'),
      };
    case 'SET_PARAMS':
      return { ...s, params: action.params };
    case 'SET_EXERCISE':
      return {
        ...s,
        exercise: action.exercise,
        params: action.params ?? { ...EXERCISES[action.exercise].defaults, theme: state.params.theme, photoIds: state.params.photoIds },
        phase: state.phase === 'paused' ? 'paused' : 'between',
        pausedFrom: state.phase === 'paused' ? 'between' : null,
        trial: null,
        cues: [],
        undo: [],
      };
    case 'SET_SOUND':
      return { ...s, soundEnabled: action.enabled };
  }
}

/**
 * Core domain types for Leftward.
 *
 * Design rules encoded here (see docs/ADAPTIVE_RULES.md):
 *  - The app never senses gaze. Every "response" is a caregiver-entered observation.
 *  - Eye shift, head turn and "seemed to identify the target" are recorded separately.
 *  - A response after any cue can never be classed as spontaneous.
 *  - "No response observed" and "cannot determine / fatigue" are distinct and never
 *    interpreted as visual-field loss or attentional failure.
 *  - Physical sides refer to the physical screen, independent of RTL text direction.
 */

/** Physical side on the screen (independent of text direction). */
export type PhysicalSide = 'left' | 'center' | 'right';

export type Readiness = 'alert' | 'tired' | 'not_fit';

export type VisionPreviewResponse = 'noticed' | 'unclear' | 'not_noticed' | 'skipped';

export type GlassesContext = 'wearing' | 'not_available' | 'not_recorded';

export interface ReadinessContext {
  readiness: Readiness;
  recordedAt: number;
}

export interface VisionContext {
  preview: VisionPreviewResponse;
  glasses: GlassesContext;
}

export type DeviceClass = 'desktop' | 'tablet-landscape' | 'tablet-portrait' | 'phone' | 'unknown';

export type ExerciseId =
  | 'guided_orienting'
  | 'visual_scanning'
  | 'target_search'
  | 'saccadic_exploration'
  | 'focus_initiation'
  | 'leftward_pursuit'
  | 'alert_then_target';

export type StimulusTheme = 'shapes' | 'cars' | 'watches' | 'photos';

/** Stimulus size steps; all are large. */
export type StimulusSize = 'large' | 'xlarge' | 'huge';
export const SIZE_ORDER: StimulusSize[] = ['large', 'xlarge', 'huge'];

export type ContrastMode = 'high_dark' | 'high_light';

/** Cue categories offered to the caregiver. */
export type CueType =
  | 'visual' // on-screen highlight at a side
  | 'neutral_tone' // soft non-spatial tone
  | 'verbal_left' // generic spoken "look left" (no name)
  | 'verbal_alert' // generic spoken "שים לב" — non-spatial alerting
  | 'first_name'
  | 'nickname'
  | 'name_plus_left' // name/nickname + request to look left
  | 'other';

export type CueDelivery =
  | 'on_screen'
  | 'caregiver_spoken'
  | 'local_tts'
  | 'imported_audio'
  | 'device_tone'
  | 'caregiver_other'
  | 'unknown';

/** Whether a cue carries spatial (directional) information. */
export type CueSpatiality = 'spatial' | 'nonspatial' | 'unknown';

export interface CueEvent {
  id: string;
  /** 1-based position within the trial — preserves the actual order of delivery. */
  order: number;
  type: CueType;
  delivery: CueDelivery;
  /** For spatial cues: the physical side the cue pointed to. */
  side?: PhysicalSide;
  /** valid = pointed at the target side; invalid = opposite (advanced only). */
  validity: 'valid' | 'invalid' | 'not_applicable';
  /** ms since trial start; informational only, never used to score. */
  tMs: number;
  /** True if given BEFORE the target was shown (alert-then-target exercise). */
  preTarget?: boolean;
}

/** What the caregiver saw. Relative to the target side of the trial. */
export type ResponseModality = 'eyes' | 'head' | 'eyes_and_head' | 'unclear_kind';

export type ObservationOutcome =
  | { kind: 'oriented'; modality: ResponseModality }
  | { kind: 'other_direction' }
  | { kind: 'no_response_observed' }
  | { kind: 'cannot_determine'; reason: 'uncertain' | 'fatigue' | 'visibility' };

/** When the observed response happened relative to cues. */
export type ResponseTiming = 'no_cues_given' | 'before_first_cue' | 'after_cue';

export type IdentificationJudgment = 'seemed_to_identify' | 'not_sure' | 'not_recorded';

export interface ObservationFlags {
  fatigue: boolean;
  discomfort: boolean;
  poorVisibility: boolean;
  lostEngagement: boolean;
}

export const NO_FLAGS: ObservationFlags = {
  fatigue: false,
  discomfort: false,
  poorVisibility: false,
  lostEngagement: false,
};

export interface Observation {
  outcome: ObservationOutcome;
  /**
   * Caregiver may assert the response happened before the first cue only explicitly.
   * The default whenever cues exist is 'after_cue'.
   */
  caregiverSaysBeforeFirstCue: boolean;
  identification: IdentificationJudgment;
  flags: ObservationFlags;
  /** Optional manual caregiver marks for search exercises (object ids). Not patient gaze. */
  caregiverMarkedObjectIds: string[];
  note?: string;
  recordedAt: number;
}

/** Derived, explainable response class used by progress and adaptation. */
export type ResponseClass =
  | 'spontaneous' // oriented toward target with no cue preceding it
  | 'after_spatial_cue'
  | 'after_nonspatial_cue' // e.g. name only — alerting, not evidence of spatial cueing
  | 'other_direction'
  | 'no_response_observed'
  | 'cannot_determine';

export interface StimulusItem {
  id: string;
  /** Physical x position as % of stage width (0 = physical left edge). */
  xPct: number;
  /** Physical y position as % of stage height. */
  yPct: number;
  role: 'target' | 'distractor' | 'anchor';
  /** Which asset to draw. For shapes: a shape id; for photos: an asset id. */
  glyph: string;
}

export interface TrialParams {
  theme: StimulusTheme;
  size: StimulusSize;
  contrast: ContrastMode;
  distractors: number;
  targetSide: PhysicalSide;
  showLeftAnchor: boolean;
  motion: 'none' | 'slow_pursuit' | 'leftward_drift';
  /** Seconds for a stimulus to cross the full screen width when moving (slow by design). */
  crossSeconds: number;
  /** Visual cue shown automatically at trial start (makes the trial cued from the outset). */
  startCue: 'none' | 'visual';
  /** Salience of the on-screen visual cue. */
  cueSalience: 'strong' | 'soft';
  /** Photo asset ids to draw from when theme === 'photos'. */
  photoIds: string[];
}

export interface TrialSpec {
  exercise: ExerciseId;
  index: number;
  seed: number;
  params: TrialParams;
  items: StimulusItem[];
  targetSide: PhysicalSide;
}

export interface TrialRecord {
  id: string;
  sessionId: string;
  index: number;
  exercise: ExerciseId;
  startedAt: number;
  params: TrialParams;
  targetSide: PhysicalSide;
  itemCount: number;
  cues: CueEvent[];
  observation: Observation;
  responseClass: ResponseClass;
  timing: ResponseTiming;
  /** ms from trial start to target reveal (alert-then-target only). Informational. */
  targetOnsetMs?: number;
  soundEnabled: boolean;
}

export type EndReason = 'completed' | 'fatigue' | 'discomfort' | 'not_fit' | 'caregiver_choice' | 'other';

export interface SessionRecord {
  id: string;
  startedAt: number;
  endedAt?: number;
  deviceClass: DeviceClass;
  readiness: Readiness;
  vision: VisionContext;
  plannedExercise: ExerciseId;
  description?: string;
  notes?: string;
  clinicianReviewNotes?: string;
  endReason?: EndReason;
  pauseCount: number;
  transfer?: { offered: boolean; done: boolean; note?: string };
}

export interface ExerciseDefinition {
  id: ExerciseId;
  /** Default parameters for the family route. */
  defaults: TrialParams;
  supportsDistractors: boolean;
  supportsMotion: boolean;
  /** Requires the caregiver-confirmed clinician approval for motion. */
  requiresMotionApproval: boolean;
  /** Trials start with a blank screen; target is revealed by the caregiver after an optional alert. */
  preTargetPhase: boolean;
  /** Generate the stimulus layout for a trial deterministically. */
  generate: (params: TrialParams, index: number, seed: number) => TrialSpec;
}

export interface StimulusAsset {
  id: string;
  kind: 'image' | 'audio';
  label: string;
  mime: string;
  blob: Blob;
  createdAt: number;
  /** Audio only: which cue this clip is mapped to. */
  mappedCue?: 'first_name' | 'nickname' | 'name_plus_left' | 'neutral';
}

/**
 * AdaptiveRules — a pure, deterministic, explainable suggestion engine.
 *
 * It never senses gaze, never diagnoses, never uses reaction times, d′, cut-offs or
 * norms. Its only inputs are caregiver-entered observations and caregiver-entered
 * context. Every output changes at most ONE variable and is only a suggestion: the
 * caregiver must approve it (לנסות) before anything changes.
 *
 * The thresholds below are PRODUCT HEURISTICS, not validated clinical thresholds.
 * Full rule table: docs/ADAPTIVE_RULES.md
 */
import { EXERCISES, MAX_DISTRACTORS } from './exercises';
import { isCueDependent, isPersonalCue } from './observation';
import type {
  DeviceClass,
  ExerciseId,
  Readiness,
  SessionRecord,
  StimulusSize,
  StimulusTheme,
  TrialParams,
  TrialRecord,
  VisionContext,
} from './types';
import { SIZE_ORDER } from './types';

export type RecommendationKind =
  | 'stop'
  | 'rest'
  | 'continue_same'
  | 'maintain_cue'
  | 'strengthen_cue'
  | 'reduce_cue'
  | 'add_unprompted_trial'
  | 'add_one_distractor'
  | 'switch_to_shape'
  | 'enlarge_stimulus'
  | 'try_sparse_scanning'
  | 'try_target_search';

/** Exactly one variable may change. */
export type ParamChange =
  | { variable: 'none' }
  | { variable: 'startCue'; from: TrialParams['startCue']; to: TrialParams['startCue'] }
  | { variable: 'cueSalience'; from: TrialParams['cueSalience']; to: TrialParams['cueSalience'] }
  | { variable: 'distractors'; from: number; to: number }
  | { variable: 'theme'; from: StimulusTheme; to: StimulusTheme }
  | { variable: 'size'; from: StimulusSize; to: StimulusSize }
  | { variable: 'exercise'; from: ExerciseId; to: ExerciseId }
  | { variable: 'oneTrialWithoutCue' };

export interface Recommendation {
  kind: RecommendationKind;
  ruleId: string;
  change: ParamChange;
  /** True if accepting would make the task more demanding / less assisted. */
  increasesDemand: boolean;
  rationaleHe: string;
  /** Denominators shown to the caregiver. */
  basis: { consideredTrials: number; comparableTrials: number };
}

export interface AdaptContext {
  readiness: Readiness;
  vision: VisionContext;
  exercise: ExerciseId;
  params: TrialParams;
  /** Recommendation kinds the caregiver dismissed (ביטול) during this session. */
  dismissed?: readonly RecommendationKind[];
}

const WINDOW = 3;

/** Comparability guard: same exercise and same stimulus/cue configuration. */
export function comparabilityKey(exercise: ExerciseId, p: TrialParams): string {
  const d = EXERCISES[exercise].supportsDistractors ? Math.min(p.distractors, MAX_DISTRACTORS[p.size]) : 0;
  return [exercise, p.theme, p.size, d, p.targetSide, p.startCue, p.cueSalience, p.motion].join('|');
}

function visionLimited(v: VisionContext): boolean {
  return v.preview === 'unclear' || v.preview === 'not_noticed';
}

function rec(
  kind: RecommendationKind,
  ruleId: string,
  change: ParamChange,
  increasesDemand: boolean,
  rationaleHe: string,
  considered: number,
  comparable: number,
): Recommendation {
  return { kind, ruleId, change, increasesDemand, rationaleHe, basis: { consideredTrials: considered, comparableTrials: comparable } };
}

/**
 * recommendNextStep(context, recentObservations)
 * `recent` = this session's trial records, oldest first.
 */
export function recommendNextStep(ctx: AdaptContext, recent: readonly TrialRecord[]): Recommendation {
  const considered = Math.min(recent.length, WINDOW);
  const last = recent[recent.length - 1];
  const key = comparabilityKey(ctx.exercise, ctx.params);
  const comparable: TrialRecord[] = [];
  for (let i = recent.length - 1; i >= 0 && comparable.length < WINDOW; i--) {
    const r = recent[i]!;
    if (comparabilityKey(r.exercise, r.params) !== key) break; // contiguous only
    comparable.unshift(r);
  }
  const n = comparable.length;
  const dismissed = new Set(ctx.dismissed ?? []);
  const p = ctx.params;

  // --- Safety & state gates (never framed as cognitive worsening) ---
  if (ctx.readiness === 'not_fit') {
    return rec('stop', 'R0-not-fit', { variable: 'none' }, false, RATIONALE.notFit, considered, n);
  }
  if (last?.observation.flags.discomfort) {
    return rec('stop', 'R1-discomfort', { variable: 'none' }, false, RATIONALE.discomfort, considered, n);
  }
  if (last && (last.observation.flags.fatigue || (last.observation.outcome.kind === 'cannot_determine' && last.observation.outcome.reason === 'fatigue'))) {
    return rec('rest', 'R2-fatigue', { variable: 'none' }, false, RATIONALE.fatigue, considered, n);
  }
  if (last?.observation.flags.lostEngagement) {
    return rec('rest', 'R3-engagement', { variable: 'none' }, false, RATIONALE.engagement, considered, n);
  }
  const lastVisibility =
    last && (last.observation.flags.poorVisibility || (last.observation.outcome.kind === 'cannot_determine' && last.observation.outcome.reason === 'visibility'));
  if (lastVisibility) {
    const r = simplifyVisual(p, considered, n, 'R4-visibility', RATIONALE.visibility);
    if (r && !dismissed.has(r.kind)) return r;
    return rec('rest', 'R4-visibility-rest', { variable: 'none' }, false, RATIONALE.visibilityRest, considered, n);
  }
  const lastThree = recent.slice(-WINDOW);
  const uncertain = lastThree.filter((r) => r.responseClass === 'cannot_determine').length;
  if (uncertain >= 2) {
    const r = simplifyVisual(p, considered, n, 'R5-uncertain', RATIONALE.uncertainSimplify);
    if (r && !dismissed.has(r.kind)) return r;
    return rec('rest', 'R5-uncertain-rest', { variable: 'none' }, false, RATIONALE.uncertainRest, considered, n);
  }

  // Escalation is only ever possible on an alert day, with no visibility doubt and clean comparable trials.
  const cleanComparable = comparable.every(
    (r) => !r.observation.flags.fatigue && !r.observation.flags.poorVisibility && !r.observation.flags.lostEngagement,
  );
  const mayIncrease = ctx.readiness === 'alert' && !visionLimited(ctx.vision) && cleanComparable;

  // --- Support when nothing was observed (keep or strengthen ONE cue) ---
  if (n >= 2 && comparable.slice(-2).every((r) => r.responseClass === 'no_response_observed')) {
    const r = strengthen(p, considered, n);
    if (r && !dismissed.has(r.kind)) return r;
  }

  // --- Personal-name habituation guard ---
  if (lastThree.length === WINDOW && lastThree.every((r) => r.cues.some((c) => isPersonalCue(c.type)))) {
    if (mayIncrease && !dismissed.has('add_unprompted_trial')) {
      return rec('add_unprompted_trial', 'R7-name-habituation', { variable: 'oneTrialWithoutCue' }, true, RATIONALE.nameHabituation, considered, n);
    }
  }

  // --- Three comparable unaided orientations toward a physically-left target ---
  if (n >= WINDOW && comparable.every((r) => r.responseClass === 'spontaneous')) {
    const leftward = comparable.every((r) => r.targetSide === 'left');
    if (mayIncrease && leftward) {
      const r = lessAssisted(ctx.exercise, p, considered, n);
      if (r && !dismissed.has(r.kind)) return r;
    }
    return rec('continue_same', 'R8-stable-hold', { variable: 'none' }, false, mayIncrease ? RATIONALE.stableHold : RATIONALE.stableButNotToday, considered, n);
  }

  // --- Cue dependence: keep help as is; with a start cue, offer one unprompted opportunity ---
  if (n >= WINDOW && comparable.every((r) => isCueDependent(r.responseClass)) && p.startCue === 'visual') {
    if (mayIncrease && !dismissed.has('add_unprompted_trial')) {
      return rec('add_unprompted_trial', 'R9-start-cue-check', { variable: 'oneTrialWithoutCue' }, true, RATIONALE.unpromptedCheck, considered, n);
    }
  }
  if (n >= 2 && comparable.slice(-2).every((r) => isCueDependent(r.responseClass))) {
    if (!dismissed.has('maintain_cue')) {
      return rec('maintain_cue', 'R10-cue-dependent', { variable: 'none' }, false, RATIONALE.cueDependent, considered, n);
    }
  }

  return rec('continue_same', 'R11-default', { variable: 'none' }, false, n < 2 ? RATIONALE.notEnough : RATIONALE.mixed, considered, n);
}

function simplifyVisual(p: TrialParams, considered: number, n: number, ruleId: string, why: string): Recommendation | null {
  if (p.theme !== 'shapes') {
    return rec('switch_to_shape', ruleId + '-shape', { variable: 'theme', from: p.theme, to: 'shapes' }, false, why + ' ' + RATIONALE.toShape, considered, n);
  }
  const idx = SIZE_ORDER.indexOf(p.size);
  if (idx < SIZE_ORDER.length - 1) {
    const to = SIZE_ORDER[idx + 1]!;
    return rec('enlarge_stimulus', ruleId + '-enlarge', { variable: 'size', from: p.size, to }, false, why + ' ' + RATIONALE.enlarge, considered, n);
  }
  return null;
}

function strengthen(p: TrialParams, considered: number, n: number): Recommendation | null {
  if (p.cueSalience === 'soft') {
    return rec('strengthen_cue', 'R6-no-response-salience', { variable: 'cueSalience', from: 'soft', to: 'strong' }, false, RATIONALE.noResponseSalience, considered, n);
  }
  const idx = SIZE_ORDER.indexOf(p.size);
  if (idx < SIZE_ORDER.length - 1) {
    return rec('enlarge_stimulus', 'R6-no-response-enlarge', { variable: 'size', from: p.size, to: SIZE_ORDER[idx + 1]! }, false, RATIONALE.noResponseEnlarge, considered, n);
  }
  if (p.startCue === 'none') {
    return rec('strengthen_cue', 'R6-no-response-startcue', { variable: 'startCue', from: 'none', to: 'visual' }, false, RATIONALE.noResponseStartCue, considered, n);
  }
  return rec('rest', 'R6-no-response-rest', { variable: 'none' }, false, RATIONALE.noResponseRest, considered, n);
}

function lessAssisted(exercise: ExerciseId, p: TrialParams, considered: number, n: number): Recommendation | null {
  if (p.startCue === 'visual') {
    return rec('reduce_cue', 'R8-less-start-cue', { variable: 'startCue', from: 'visual', to: 'none' }, true, RATIONALE.reduceStartCue, considered, n);
  }
  if (exercise === 'guided_orienting') {
    return rec('try_sparse_scanning', 'R8-to-scanning', { variable: 'exercise', from: exercise, to: 'visual_scanning' }, true, RATIONALE.toScanning, considered, n);
  }
  if (exercise === 'visual_scanning' || exercise === 'target_search') {
    const max = MAX_DISTRACTORS[p.size];
    if (p.distractors < max) {
      return rec('add_one_distractor', 'R8-one-distractor', { variable: 'distractors', from: p.distractors, to: p.distractors + 1 }, true, RATIONALE.oneDistractor, considered, n);
    }
    if (exercise === 'visual_scanning') {
      return rec('try_target_search', 'R8-to-search', { variable: 'exercise', from: exercise, to: 'target_search' }, true, RATIONALE.toSearch, considered, n);
    }
  }
  return null;
}

/** Apply an approved recommendation. Returns the new params / exercise (one variable changed). */
export function applyChange(exercise: ExerciseId, params: TrialParams, change: ParamChange): { exercise: ExerciseId; params: TrialParams } {
  switch (change.variable) {
    case 'none':
    case 'oneTrialWithoutCue':
      return { exercise, params };
    case 'startCue':
      return { exercise, params: { ...params, startCue: change.to } };
    case 'cueSalience':
      return { exercise, params: { ...params, cueSalience: change.to } };
    case 'distractors':
      return { exercise, params: { ...params, distractors: change.to } };
    case 'theme':
      return { exercise, params: { ...params, theme: change.to } };
    case 'size':
      return { exercise, params: { ...params, size: change.to } };
    case 'exercise': {
      const d = EXERCISES[change.to].defaults;
      // Keep the caregiver's visual choices; only the task changes.
      return { exercise: change.to, params: { ...d, theme: params.theme, contrast: params.contrast, photoIds: params.photoIds, distractors: Math.min(d.distractors, 1) } };
    }
  }
}

// ---------------------------------------------------------------------------
// Session start suggestion: driven primarily by TODAY's state.
// ---------------------------------------------------------------------------

export interface StartSuggestion {
  kind: 'no_training' | 'exercise';
  exercise: ExerciseId;
  params: TrialParams;
  ruleId: string;
  sentenceHe: string;
  /** True when history (not today's state) influenced the choice. */
  provisionalFromHistory: boolean;
}

export function recommendStart(args: {
  readiness: Readiness;
  vision: VisionContext;
  deviceClass: DeviceClass;
  preferredTheme: StimulusTheme;
  photoIds: string[];
  history: { sessions: readonly SessionRecord[]; trials: readonly TrialRecord[] };
}): StartSuggestion {
  const base = { ...EXERCISES.guided_orienting.defaults };
  if (args.readiness === 'not_fit') {
    return { kind: 'no_training', exercise: 'guided_orienting', params: base, ruleId: 'S0-not-fit', sentenceHe: START.notFit, provisionalFromHistory: false };
  }
  if (args.readiness === 'tired') {
    return { kind: 'exercise', exercise: 'guided_orienting', params: base, ruleId: 'S1-tired', sentenceHe: START.tired, provisionalFromHistory: false };
  }
  const visionUncertain = visionLimited(args.vision) || args.vision.glasses === 'not_available';
  if (visionUncertain) {
    return { kind: 'exercise', exercise: 'guided_orienting', params: base, ruleId: 'S2-vision', sentenceHe: START.vision, provisionalFromHistory: false };
  }
  const theme: StimulusTheme = args.preferredTheme === 'photos' && args.photoIds.length === 0 ? 'shapes' : args.preferredTheme;
  const themed = { ...base, theme, photoIds: args.photoIds };

  // Provisional: most recent ended session on the same device class, on an alert day.
  const prev = [...args.history.sessions]
    .filter((s) => s.deviceClass === args.deviceClass && s.readiness === 'alert')
    .sort((a, b) => b.startedAt - a.startedAt)[0];
  if (prev) {
    const t = args.history.trials.filter((r) => r.sessionId === prev.id && r.exercise === 'guided_orienting' && r.targetSide === 'left');
    const spont = t.filter((r) => r.responseClass === 'spontaneous').length;
    const interpretable = t.filter((r) => r.responseClass !== 'cannot_determine').length;
    if (spont >= 3 && spont * 2 >= interpretable) {
      const sp = { ...EXERCISES.visual_scanning.defaults, theme, photoIds: args.photoIds, distractors: 1 };
      return { kind: 'exercise', exercise: 'visual_scanning', params: sp, ruleId: 'S4-history-scanning', sentenceHe: START.scanning, provisionalFromHistory: true };
    }
  }
  return { kind: 'exercise', exercise: 'guided_orienting', params: themed, ruleId: 'S3-alert-default', sentenceHe: START.alert, provisionalFromHistory: false };
}

// ---------------------------------------------------------------------------
// Plain-Hebrew rationale (family-facing). No jargon, no clinical claims.
// ---------------------------------------------------------------------------
export const RATIONALE = {
  notFit: 'צוין שזה לא זמן מתאים. עדיף לנוח ולא לתרגל עכשיו.',
  discomfort: 'סומנה אי־נוחות. מומלץ לעצור עכשיו. אם משהו השתנה פתאום — פנו לצוות המטפל.',
  fatigue: 'סומנה עייפות. הפסקה קצרה או סיום הם בחירה טובה. זה לא סימן להחמרה.',
  engagement: 'נראה שהקשב ירד. אפשר לנוח ולחזור אחר כך, או לסיים להיום.',
  visibility: 'סומן שהתמונה אולי לא נראית היטב.',
  visibilityRest: 'סומן שהתמונה אולי לא נראית היטב, והיא כבר בגודל ובצורה הפשוטים ביותר. כדאי לעצור ולבדוק תאורה, מרחק ומשקפיים.',
  uncertainSimplify: 'בכמה ניסיונות אחרונים לא היה ברור מה קרה.',
  uncertainRest: 'בכמה ניסיונות אחרונים לא היה ברור מה קרה. אפשר לנוח. זה לא אומר שמשהו החמיר.',
  toShape: 'אפשר לעבור לצורה פשוטה וגדולה שקל יותר לראות.',
  enlarge: 'אפשר להגדיל את המטרה.',
  noResponseSalience: 'בשני ניסיונות דומים לא נראתה תגובה. אפשר להפוך את הרמז החזותי לבולט יותר.',
  noResponseEnlarge: 'בשני ניסיונות דומים לא נראתה תגובה. אפשר להגדיל את המטרה. ייתכן שהסיבה היא עייפות, ראייה או משהו אחר.',
  noResponseStartCue: 'בשני ניסיונות דומים לא נראתה תגובה. אפשר להציג רמז חזותי כבר בתחילת כל ניסיון.',
  noResponseRest: 'בשני ניסיונות דומים לא נראתה תגובה, והעזרה כבר במקסימום. כדאי לנוח. זה לא אומר שמשהו החמיר.',
  nameHabituation: 'השם או הכינוי שימשו בשלושה ניסיונות ברצף. כדאי לנסות ניסיון אחד בלי רמז, כדי שהפנייה בשם לא תהפוך לשגרה.',
  stableHold: 'יש תגובות עצמאיות, אבל אין צעד קל נוסף להציע כרגע. אפשר להמשיך כך.',
  stableButNotToday: 'נראו תגובות עצמאיות. בגלל העייפות או הראייה היום, לא נציע להקשות. אפשר להמשיך כך.',
  reduceStartCue: 'בשלושה ניסיונות דומים נראתה הפניה עצמאית לשמאל. אפשר לנסות בלי הרמז שמופיע בהתחלה.',
  toScanning: 'בשלושה ניסיונות דומים נראתה הפניה עצמאית לשמאל. אפשר לנסות תרגול סריקה פשוט עם שני חפצים גדולים.',
  oneDistractor: 'בשלושה ניסיונות דומים נראתה הפניה עצמאית לשמאל. אפשר להוסיף חפץ אחד בלבד, באותו גודל.',
  toSearch: 'בשלושה ניסיונות דומים נראתה הפניה עצמאית לשמאל. אפשר לנסות חיפוש פשוט של חפץ אחד בין מעטים.',
  unpromptedCheck: 'בשלושה ניסיונות התגובה הופיעה אחרי הרמז שמוצג בהתחלה. אפשר לנסות ניסיון אחד בלי הרמז, ולראות מה קורה.',
  cueDependent: 'בשני ניסיונות דומים התגובה הופיעה אחרי עזרה. כדאי להמשיך עם אותה עזרה, בלי להקשות.',
  notEnough: 'אין עדיין מספיק ניסיונות דומים כדי להציע שינוי. אפשר להמשיך כך.',
  mixed: 'התגובות מעורבות. אפשר להמשיך כך, בלי שינוי.',
} as const;

export const START = {
  notFit: 'היום לא מתרגלים. מנוחה היא הבחירה הנכונה.',
  tired: 'נתחיל בחפץ אחד גדול ונעזור לו להתייחס גם לצד שמאל. אפשר לעצור בכל רגע.',
  vision: 'נתחיל בצורה אחת גדולה וברורה בצד שמאל, כדי שיהיה קל לראות.',
  alert: 'נתחיל בחפץ אחד גדול ונעזור לו להתייחס גם לצד שמאל.',
  scanning: 'במפגש קודם נראו הפניות עצמאיות לשמאל, אז נציע שני חפצים גדולים להסתכל עליהם. אם היום שונה — אפשר לחזור לחפץ אחד.',
} as const;

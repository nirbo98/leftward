import { mulberry32, pick } from './rng';
import type {
  ExerciseDefinition,
  ExerciseId,
  PhysicalSide,
  StimulusItem,
  StimulusSize,
  StimulusTheme,
  TrialParams,
  TrialSpec,
} from './types';

/** Physical x-centres (% of stage width, 0 = physical LEFT edge). */
export const SIDE_X: Record<PhysicalSide, number> = { left: 16, center: 50, right: 84 };

/** Maximum distractors that still keep objects large and well separated. */
export const MAX_DISTRACTORS: Record<StimulusSize, number> = { large: 5, xlarge: 3, huge: 2 };

export const GLYPHS: Record<Exclude<StimulusTheme, 'photos'>, { target: string[]; distractor: string[] }> = {
  shapes: { target: ['disc'], distractor: ['square', 'diamond'] },
  cars: { target: ['car_roadster', 'car_coupe'], distractor: ['car_sedan'] },
  watches: { target: ['watch_round'], distractor: ['watch_square', 'watch_pocket'] },
};

function glyphFor(params: TrialParams, role: 'target' | 'distractor', rand: () => number): string {
  if (params.theme === 'photos') {
    if (params.photoIds.length === 0) return role === 'target' ? 'disc' : 'square';
    return 'photo:' + pick(rand, params.photoIds);
  }
  return pick(rand, GLYPHS[params.theme][role]);
}

export function clampDistractors(params: TrialParams): number {
  return Math.max(0, Math.min(params.distractors, MAX_DISTRACTORS[params.size]));
}

const BASE: TrialParams = {
  theme: 'shapes',
  size: 'huge',
  contrast: 'high_dark',
  distractors: 0,
  targetSide: 'left',
  showLeftAnchor: false,
  motion: 'none',
  crossSeconds: 20,
  startCue: 'none',
  cueSalience: 'strong',
  photoIds: [],
};

function single(exercise: ExerciseId, params: TrialParams, index: number, seed: number, side: PhysicalSide): TrialSpec {
  const rand = mulberry32(seed + index * 7919);
  const items: StimulusItem[] = [
    { id: 't0', xPct: SIDE_X[side], yPct: 50, role: 'target', glyph: glyphFor(params, 'target', rand) },
  ];
  return { exercise, index, seed, params, items, targetSide: side };
}

/** Evenly spread items across physical width; target is placed at the physical-left end. */
function spread(
  exercise: ExerciseId,
  params: TrialParams,
  index: number,
  seed: number,
  distinctTarget: boolean,
): TrialSpec {
  const rand = mulberry32(seed + index * 104729);
  const d = clampDistractors(params);
  const n = d + 1;
  const items: StimulusItem[] = [];
  const left = 14;
  const right = 86;
  const targetSlot = params.targetSide === 'right' ? n - 1 : params.targetSide === 'center' ? Math.floor(n / 2) : 0;
  for (let i = 0; i < n; i++) {
    const x = n === 1 ? SIDE_X[params.targetSide] : left + ((right - left) * i) / (n - 1);
    const y = n <= 2 ? 50 : i % 2 === 0 ? 34 : 66;
    const isTarget = i === targetSlot;
    const role = isTarget ? 'target' : 'distractor';
    const glyph = isTarget || !distinctTarget ? glyphFor(params, 'target', rand) : glyphFor(params, 'distractor', rand);
    items.push({ id: (isTarget ? 't' : 'd') + i, xPct: Math.round(x * 10) / 10, yPct: y, role, glyph });
  }
  return { exercise, index, seed, params, items, targetSide: params.targetSide };
}

/** Static relocation sequence, weighted toward the physical left. */
export const SACCADE_SEQUENCE: PhysicalSide[] = ['left', 'right', 'left', 'center', 'left', 'right'];

export const EXERCISES: Record<ExerciseId, ExerciseDefinition> = {
  guided_orienting: {
    id: 'guided_orienting',
    defaults: { ...BASE },
    supportsDistractors: false,
    supportsMotion: false,
    requiresMotionApproval: false,
    preTargetPhase: false,
    generate: (p, i, s) => single('guided_orienting', p, i, s, p.targetSide),
  },
  visual_scanning: {
    id: 'visual_scanning',
    defaults: { ...BASE, size: 'xlarge', distractors: 1, showLeftAnchor: true },
    supportsDistractors: true,
    supportsMotion: false,
    requiresMotionApproval: false,
    preTargetPhase: false,
    generate: (p, i, s) => spread('visual_scanning', p, i, s, false),
  },
  target_search: {
    id: 'target_search',
    defaults: { ...BASE, size: 'xlarge', distractors: 2, showLeftAnchor: true },
    supportsDistractors: true,
    supportsMotion: false,
    requiresMotionApproval: false,
    preTargetPhase: false,
    generate: (p, i, s) => spread('target_search', p, i, s, true),
  },
  saccadic_exploration: {
    id: 'saccadic_exploration',
    defaults: { ...BASE, size: 'xlarge' },
    supportsDistractors: false,
    supportsMotion: true,
    requiresMotionApproval: false,
    preTargetPhase: false,
    generate: (p, i, s) => {
      if (p.motion === 'slow_pursuit') {
        // Starts physically right and drifts slowly to the physical left (animated by the stage).
        const spec = single('saccadic_exploration', p, i, s, 'left');
        return { ...spec, items: spec.items.map((it) => ({ ...it, xPct: SIDE_X.right })) };
      }
      const side = SACCADE_SEQUENCE[i % SACCADE_SEQUENCE.length] ?? 'left';
      return single('saccadic_exploration', p, i, s, side);
    },
  },
  focus_initiation: {
    id: 'focus_initiation',
    defaults: { ...BASE, targetSide: 'center' },
    supportsDistractors: false,
    supportsMotion: false,
    requiresMotionApproval: false,
    preTargetPhase: false,
    generate: (p, i, s) => single('focus_initiation', p, i, s, p.targetSide),
  },
  /**
   * Inspired by smooth-pursuit training with leftward-moving displays (Kerkhoff et al. 2006, 2013).
   * NOT a replication of that protocol: a few large, well-separated stimuli drift slowly leftward
   * and wrap around. Clinician-approval gated; disabled by reduced motion; pause freezes it.
   */
  leftward_pursuit: {
    id: 'leftward_pursuit',
    defaults: { ...BASE, size: 'xlarge', distractors: 2, motion: 'leftward_drift', crossSeconds: 20 },
    supportsDistractors: true,
    supportsMotion: true,
    requiresMotionApproval: true,
    preTargetPhase: false,
    generate: (p, i, s) => {
      const rand = mulberry32(s + i * 31337);
      const n = Math.min(3, clampDistractors(p) + 1);
      const glyph = glyphFor(p, 'target', rand);
      const items: StimulusItem[] = Array.from({ length: n }, (_, k) => ({
        id: (k === 0 ? 't' : 'd') + k,
        // Evenly spaced across the full cycle so objects never bunch together.
        xPct: Math.round((100 / n) * k + 100 / (2 * n)),
        yPct: n === 1 ? 50 : k % 2 === 0 ? 40 : 60,
        role: k === 0 ? 'target' : 'distractor',
        glyph,
      }));
      return { exercise: 'leftward_pursuit', index: i, seed: s, params: { ...p, motion: 'leftward_drift' }, items, targetSide: 'left' };
    },
  },
  /**
   * Inspired by phasic-alerting findings (Robertson et al. 1998): a NON-spatial alert (name,
   * "שים לב", soft tone) given just before the target appears, compared descriptively with
   * trials without an alert. Timing is controlled by the caregiver — no fixed sub-second SOA.
   */
  alert_then_target: {
    id: 'alert_then_target',
    defaults: { ...BASE },
    supportsDistractors: false,
    supportsMotion: false,
    requiresMotionApproval: false,
    preTargetPhase: true,
    generate: (p, i, s) => single('alert_then_target', p, i, s, p.targetSide),
  },
};

export const EXERCISE_ORDER: ExerciseId[] = [
  'guided_orienting',
  'visual_scanning',
  'target_search',
  'saccadic_exploration',
  'focus_initiation',
  'alert_then_target',
  'leftward_pursuit',
];

/** Alternating with/without-alert schedule (even trials: alert). A suggestion only. */
export function alertPlanned(index: number): boolean {
  return index % 2 === 0;
}

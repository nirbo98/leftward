import type { ContrastMode, CueType, StimulusSize, StimulusTheme } from '../domain/types';

export interface AppSettings {
  schemaVersion: 1;
  advancedMode: boolean;
  preferredTheme: StimulusTheme;
  selectedPhotoIds: string[];
  contrast: ContrastMode;
  defaultSize: StimulusSize;
  /** 'system' follows prefers-reduced-motion; 'always' forces reduced motion. */
  reduceMotion: 'system' | 'always';
  sound: {
    /** OFF on every fresh install. */
    enabled: boolean;
    /** 0..1, starts low. */
    volume: number;
    /** Panning toward a side stays off until the caregiver verified direction is perceptible. */
    panVerified: boolean;
    panEnabled: boolean;
  };
  /** Advanced, research-inspired: cue on the side opposite the target. OFF by default. */
  allowInvalidCues: boolean;
  /** Slow pursuit requires a caregiver-confirmed clinician approval. */
  pursuitApprovedByClinician: boolean;
  /** Order in which "עזרה נוספת" applies cues. */
  cueLadder: CueType[];
  onboardingSeen: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  schemaVersion: 1,
  advancedMode: false,
  preferredTheme: 'shapes',
  selectedPhotoIds: [],
  contrast: 'high_dark',
  defaultSize: 'huge',
  reduceMotion: 'system',
  sound: { enabled: false, volume: 0.25, panVerified: false, panEnabled: false },
  allowInvalidCues: false,
  pursuitApprovedByClinician: false,
  cueLadder: ['visual', 'verbal_left', 'name_plus_left'],
  onboardingSeen: false,
};

export type PreferredAddress = 'unset' | 'first_name' | 'nickname' | 'both';

export interface PersonalCueSettings {
  firstName: string;
  nicknames: string[];
  preferredAddress: PreferredAddress;
  /** OFF until a deliberate opt-in. */
  enabled: boolean;
  modes: { caregiverSpoken: boolean; localTts: boolean; importedAudio: boolean };
  phrase: 'name_only' | 'name_plus_left';
  tts: { voiceURI: string | null; verifiedOffline: boolean; verifiedAt: number | null };
}

export const DEFAULT_PERSONAL: PersonalCueSettings = {
  firstName: '',
  nicknames: [],
  preferredAddress: 'unset',
  enabled: false,
  modes: { caregiverSpoken: true, localTts: false, importedAudio: false },
  phrase: 'name_only',
  tts: { voiceURI: null, verifiedOffline: false, verifiedAt: null },
};

/** Merge stored (possibly older) settings over defaults — safe across upgrades. */
export function normalizeSettings(raw: unknown): AppSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<AppSettings>;
  return {
    ...DEFAULT_SETTINGS,
    ...r,
    schemaVersion: 1,
    sound: { ...DEFAULT_SETTINGS.sound, ...(r.sound ?? {}) },
    cueLadder: Array.isArray(r.cueLadder) && r.cueLadder.length > 0 ? r.cueLadder : DEFAULT_SETTINGS.cueLadder,
    selectedPhotoIds: Array.isArray(r.selectedPhotoIds) ? r.selectedPhotoIds : [],
  };
}

export function normalizePersonal(raw: unknown): PersonalCueSettings {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Partial<PersonalCueSettings>;
  return {
    ...DEFAULT_PERSONAL,
    ...r,
    nicknames: Array.isArray(r.nicknames) ? r.nicknames.filter((n) => typeof n === 'string') : [],
    modes: { ...DEFAULT_PERSONAL.modes, ...(r.modes ?? {}) },
    tts: { ...DEFAULT_PERSONAL.tts, ...(r.tts ?? {}) },
  };
}

/**
 * Name/nickname validation. Letters (Hebrew/Latin), spaces, apostrophe, geresh,
 * gershayim, hyphen and period; 1–30 characters. Rejects anything URL- or markup-like.
 */
export function validateName(value: string): { ok: true; value: string } | { ok: false; errorHe: string } {
  const v = value.normalize('NFC').replace(/\s+/g, ' ').trim();
  if (v.length === 0) return { ok: false, errorHe: 'השדה ריק.' };
  if (v.length > 30) return { ok: false, errorHe: 'עד 30 תווים בבקשה.' };
  if (!/^[\p{L}\p{M}' ׳״"\-.]+$/u.test(v)) return { ok: false, errorHe: 'אפשר להשתמש רק באותיות, רווחים, מקף וגרש.' };
  return { ok: true, value: v };
}

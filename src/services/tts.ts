/**
 * On-device Hebrew speech synthesis — a conditional enhancement that FAILS CLOSED.
 *
 * Personal text (a name or nickname) is only ever passed to speechSynthesis when:
 *   1. the caregiver opted in,
 *   2. the selected voice is Hebrew AND reports `localService === true`, and
 *   3. the caregiver verified playback while the device was OFFLINE
 *      (navigator.onLine === false) using a neutral, non-personal test phrase.
 * If any condition is unmet, the mode is unavailable and the UI offers the
 * caregiver-spoken cue or an imported family audio clip instead. No remote TTS is used.
 */

export type TtsAvailability =
  | { status: 'unsupported' }
  | { status: 'no_local_hebrew_voice'; hebrewVoices: number }
  | { status: 'available'; voices: SpeechSynthesisVoice[] };

function synth(): SpeechSynthesis | null {
  return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
}

export function isLocalHebrewVoice(v: Pick<SpeechSynthesisVoice, 'lang' | 'localService'>): boolean {
  return v.localService === true && /^(he|iw)([-_]|$)/i.test(v.lang);
}

/** Voices load asynchronously in Safari/Chrome; wait briefly for them. */
export async function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  const s = synth();
  if (!s) return [];
  const now = s.getVoices();
  if (now.length > 0) return now;
  return new Promise((resolve) => {
    const done = () => resolve(s.getVoices());
    const t = setTimeout(done, timeoutMs);
    s.addEventListener?.(
      'voiceschanged',
      () => {
        clearTimeout(t);
        done();
      },
      { once: true },
    );
  });
}

export async function checkTtsAvailability(): Promise<TtsAvailability> {
  if (!synth() || typeof SpeechSynthesisUtterance === 'undefined') return { status: 'unsupported' };
  const voices = await loadVoices();
  const hebrew = voices.filter((v) => /^(he|iw)([-_]|$)/i.test(v.lang));
  const local = hebrew.filter(isLocalHebrewVoice);
  if (local.length === 0) return { status: 'no_local_hebrew_voice', hebrewVoices: hebrew.length };
  return { status: 'available', voices: local };
}

export const NEUTRAL_TEST_PHRASE = 'שלום, זו בדיקת קול.';

function speakWith(voice: SpeechSynthesisVoice, text: string, volume: number): Promise<boolean> {
  const s = synth();
  if (!s) return Promise.resolve(false);
  s.cancel();
  return new Promise((resolve) => {
    const u = new SpeechSynthesisUtterance(text);
    u.voice = voice;
    u.lang = voice.lang;
    u.rate = 0.85;
    u.volume = Math.max(0, Math.min(1, volume));
    u.onend = () => resolve(true);
    u.onerror = () => resolve(false);
    s.speak(u);
  });
}

/** Offline verification with a neutral phrase (never the personal name). */
export async function runOfflineVerification(voiceURI: string, volume: number): Promise<
  { ok: true } | { ok: false; reason: 'online' | 'voice_missing' | 'not_local' | 'playback_failed' }
> {
  if (navigator.onLine !== false) return { ok: false, reason: 'online' };
  const voices = await loadVoices();
  const v = voices.find((x) => x.voiceURI === voiceURI);
  if (!v) return { ok: false, reason: 'voice_missing' };
  if (!isLocalHebrewVoice(v)) return { ok: false, reason: 'not_local' };
  const played = await speakWith(v, NEUTRAL_TEST_PHRASE, volume);
  return played ? { ok: true } : { ok: false, reason: 'playback_failed' };
}

/**
 * Speak personal text. Re-checks every precondition at call time; refuses otherwise.
 * Must be called from a user gesture.
 */
export async function speakPersonal(args: {
  text: string;
  voiceURI: string | null;
  verifiedOffline: boolean;
  optedIn: boolean;
  volume: number;
}): Promise<boolean> {
  if (!args.optedIn || !args.verifiedOffline || !args.voiceURI || !args.text) return false;
  const voices = await loadVoices();
  const v = voices.find((x) => x.voiceURI === args.voiceURI);
  if (!v || !isLocalHebrewVoice(v)) return false;
  return speakWith(v, args.text, args.volume);
}

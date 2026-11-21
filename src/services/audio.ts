/**
 * AudioService — output only. No microphone, no recording, no autoplay.
 * - Sound is OFF by default; nothing plays unless the caregiver enabled sound AND
 *   pressed a button (user gesture, required by iPadOS/Safari).
 * - One sound at a time; low volume; soft fade in/out; no sudden sounds.
 * - Panning on built-in speakers is optional and does not prove sound localization.
 */
type Ctx = AudioContext;

let ctx: Ctx | null = null;
let current: { stop: () => void } | null = null;

function getCtx(): Ctx | null {
  if (ctx) return ctx;
  const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
  const C = W.AudioContext ?? W.webkitAudioContext;
  if (!C) return null;
  try {
    ctx = new C();
  } catch {
    ctx = null;
  }
  return ctx;
}

export function stopAll(): void {
  current?.stop();
  current = null;
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignore */
  }
}

export interface ToneOptions {
  volume: number; // 0..1
  pan?: -1 | 0 | 1; // physical left = -1
}

/** Gentle 0.35 s sine tone. Must be called from a user gesture. Returns false if unavailable. */
export async function playTone(opts: ToneOptions): Promise<boolean> {
  const c = getCtx();
  if (!c) return false;
  stopAll();
  try {
    if (c.state === 'suspended') await c.resume();
  } catch {
    return false;
  }
  const osc = c.createOscillator();
  const gain = c.createGain();
  osc.type = 'sine';
  osc.frequency.value = 523.25;
  const peak = Math.max(0, Math.min(1, opts.volume)) * 0.18;
  const t0 = c.currentTime;
  gain.gain.setValueAtTime(0, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + 0.08);
  gain.gain.linearRampToValueAtTime(0, t0 + 0.35);
  let node: AudioNode = gain;
  if (opts.pan && typeof c.createStereoPanner === 'function') {
    const p = c.createStereoPanner();
    p.pan.value = opts.pan;
    gain.connect(p);
    node = p;
  }
  osc.connect(gain);
  node.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + 0.4);
  current = {
    stop: () => {
      try {
        osc.stop();
      } catch {
        /* already stopped */
      }
    },
  };
  return true;
}

/** Play a locally stored Blob (imported relative's clip). Must be called from a user gesture. */
export async function playBlob(blob: Blob, volume: number): Promise<boolean> {
  stopAll();
  const url = URL.createObjectURL(blob);
  const el = new Audio();
  el.src = url;
  el.volume = Math.max(0, Math.min(1, volume));
  const cleanup = () => URL.revokeObjectURL(url);
  el.addEventListener('ended', cleanup, { once: true });
  el.addEventListener('error', cleanup, { once: true });
  current = {
    stop: () => {
      el.pause();
      cleanup();
    },
  };
  try {
    await el.play();
    return true;
  } catch {
    cleanup();
    return false;
  }
}

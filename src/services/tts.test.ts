import { checkTtsAvailability, isLocalHebrewVoice, runOfflineVerification, speakPersonal } from './tts';

type V = Pick<SpeechSynthesisVoice, 'lang' | 'localService' | 'voiceURI' | 'name' | 'default'>;

function installSynth(voices: V[]) {
  const spoken: string[] = [];
  const synth = {
    getVoices: () => voices,
    speak: (u: { text: string; onend?: () => void }) => {
      spoken.push(u.text);
      u.onend?.();
    },
    cancel: () => {},
    addEventListener: () => {},
  };
  Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true });
  (globalThis as unknown as { SpeechSynthesisUtterance: unknown }).SpeechSynthesisUtterance = class {
    text: string;
    voice: unknown;
    lang = '';
    rate = 1;
    volume = 1;
    onend?: () => void;
    onerror?: () => void;
    constructor(t: string) {
      this.text = t;
    }
  };
  return spoken;
}

function setOnline(v: boolean) {
  Object.defineProperty(navigator, 'onLine', { value: v, configurable: true });
}

const remoteHe: V = { lang: 'he-IL', localService: false, voiceURI: 'remote-he', name: 'r', default: false };
const localHe: V = { lang: 'he-IL', localService: true, voiceURI: 'local-he', name: 'l', default: false };
const localEn: V = { lang: 'en-US', localService: true, voiceURI: 'local-en', name: 'e', default: true };

describe('on-device TTS fails closed (acceptance 6)', () => {
  afterEach(() => setOnline(true));

  it('only local Hebrew voices qualify', () => {
    expect(isLocalHebrewVoice(localHe)).toBe(true);
    expect(isLocalHebrewVoice(remoteHe)).toBe(false);
    expect(isLocalHebrewVoice(localEn)).toBe(false);
  });

  it('reports no local Hebrew voice when only remote/other voices exist', async () => {
    installSynth([remoteHe, localEn]);
    expect(await checkTtsAvailability()).toEqual({ status: 'no_local_hebrew_voice', hebrewVoices: 1 });
  });

  it('verification refuses while online and never speaks the name', async () => {
    const spoken = installSynth([localHe]);
    setOnline(true);
    expect(await runOfflineVerification('local-he', 0.3)).toEqual({ ok: false, reason: 'online' });
    setOnline(false);
    expect(await runOfflineVerification('local-he', 0.3)).toEqual({ ok: true });
    expect(spoken).toEqual(['שלום, זו בדיקת קול.']);
  });

  it('speakPersonal refuses without opt-in, verification, or a local voice', async () => {
    const spoken = installSynth([remoteHe, localHe]);
    const base = { text: 'בדיקה', voiceURI: 'local-he', verifiedOffline: true, optedIn: true, volume: 0.3 };
    expect(await speakPersonal({ ...base, optedIn: false })).toBe(false);
    expect(await speakPersonal({ ...base, verifiedOffline: false })).toBe(false);
    expect(await speakPersonal({ ...base, voiceURI: 'remote-he' })).toBe(false);
    expect(spoken).toEqual([]);
    expect(await speakPersonal(base)).toBe(true);
    expect(spoken).toEqual(['בדיקה']);
  });

  it('unsupported browsers degrade gracefully', async () => {
    Object.defineProperty(window, 'speechSynthesis', { value: undefined, configurable: true });
    delete (window as unknown as Record<string, unknown>).speechSynthesis;
    expect(await checkTtsAvailability()).toEqual({ status: 'unsupported' });
  });
});

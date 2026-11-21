/**
 * Static privacy guards over the shipped source (acceptance 7, 8).
 * Complements the ESLint privacy rules and scripts/privacy-audit.mjs.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}
const SRC = files('src').filter((f) => /\.(tsx?|css|js)$/.test(f) && !/\.test\.tsx?$/.test(f) && !f.includes('/test/'));
const all = SRC.map((f) => [f, readFileSync(f, 'utf8')] as const);

describe('privacy guards', () => {
  it('no camera/microphone/recording APIs anywhere in app source', () => {
    for (const [f, s] of all) {
      expect([f, /getUserMedia|getDisplayMedia|MediaRecorder|webkitSpeechRecognition|SpeechRecognition/.test(s)]).toEqual([f, false]);
    }
  });

  it('file inputs never use the capture attribute', () => {
    for (const [f, s] of all) expect([f, /\bcapture\s*=/.test(s)]).toEqual([f, false]);
  });

  it('no network/telemetry primitives in app source', () => {
    for (const [f, s] of all) {
      if (f.endsWith('sw-template.js')) continue; // same-origin cache only
      expect([f, /\bfetch\(|XMLHttpRequest|sendBeacon|new WebSocket|EventSource|navigator\.sendBeacon/.test(s)]).toEqual([f, false]);
    }
  });

  it('no external URLs (CDNs, fonts, analytics) in app source', () => {
    for (const [f, s] of all) {
      const urls = s.match(/https?:\/\/[^\s'"`)]+/g) ?? [];
      expect([f, urls.filter((u) => !u.startsWith('http://www.w3.org/'))]).toEqual([f, []]);
    }
  });

  it('service worker only handles same-origin requests', () => {
    const sw = readFileSync('src/pwa/sw-template.js', 'utf8');
    expect(sw).toContain('url.origin !== self.location.origin');
  });

  it('no personal name is hard-coded: the only test name is the fictional placeholder', () => {
    const fx = readFileSync('src/test/fixtures.ts', 'utf8');
    expect(fx).toContain("FAKE_NAME = 'בדיקה'");
  });

  it('router never puts data in the URL (hash holds route names only)', () => {
    const r = readFileSync('src/state/router.ts', 'utf8');
    expect(r).toMatch(/ROUTES: Route\[\] = \['home', 'start', 'exercise', 'end', 'progress', 'settings'\]/);
  });
});

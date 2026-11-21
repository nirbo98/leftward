import * as db from './db';
import { buildBackup, buildClinicianReport, parseBackup, trialsToCsv } from './exportImport';
import { DEFAULT_PERSONAL, DEFAULT_SETTINGS, validateName } from './settings';
import type { SessionRecord } from '../domain/types';
import { FAKE_NAME, FAKE_NICK, trial } from '../test/fixtures';

const session: SessionRecord = { id: 's1', startedAt: 1_700_000_000_000, deviceClass: 'desktop', readiness: 'alert', vision: { preview: 'noticed', glasses: 'wearing' }, plannedExercise: 'guided_orienting', pauseCount: 0 };

beforeEach(async () => {
  await db.eraseAllData();
  db.__resetDbHandleForTests();
});

describe('IndexedDB storage (acceptance 8, 10)', () => {
  it('defaults: sound OFF, personal cues OFF, advanced OFF on fresh install', async () => {
    const s = await db.getSettings();
    expect(s.sound.enabled).toBe(false);
    expect(s.advancedMode).toBe(false);
    expect(s.allowInvalidCues).toBe(false);
    const p = await db.getPersonal();
    expect(p.enabled).toBe(false);
    expect(p.modes.localTts).toBe(false);
    expect(p.firstName).toBe('');
  });

  it('persists sessions/trials/assets and erasure survives a "reload"', async () => {
    await db.putSession(session);
    await db.putTrial(trial({ sessionId: 's1' }));
    await db.savePersonal({ ...DEFAULT_PERSONAL, firstName: FAKE_NAME, enabled: true });
    await db.putAsset({ id: 'a1', kind: 'audio', label: 'x', mime: 'audio/mp4', blob: new Blob(['x']), createdAt: 1, mappedCue: 'nickname' });
    db.__resetDbHandleForTests(); // simulate reload
    expect(await db.listSessions()).toHaveLength(1);
    expect((await db.getPersonal()).firstName).toBe(FAKE_NAME);
    await db.eraseAllData();
    db.__resetDbHandleForTests(); // reload again
    expect(await db.listSessions()).toHaveLength(0);
    expect(await db.listTrials()).toHaveLength(0);
    expect(await db.listAssets()).toHaveLength(0);
    expect((await db.getPersonal()).firstName).toBe('');
  });

  it('deleteSession removes its trials', async () => {
    await db.putSession(session);
    await db.putTrial(trial({ sessionId: 's1' }));
    await db.putTrial(trial({ sessionId: 'other' }));
    await db.deleteSession('s1');
    expect((await db.listTrials()).map((t) => t.sessionId)).toEqual(['other']);
  });
});

describe('export / backup', () => {
  const personal = { ...DEFAULT_PERSONAL, firstName: FAKE_NAME, nicknames: [FAKE_NICK], enabled: true };

  it('default backup excludes name/nickname and media', async () => {
    const b = await buildBackup({ settings: DEFAULT_SETTINGS, sessions: [session], trials: [trial({})], personal, assets: [], includeIdentifiers: false, includeMedia: false, now: 1 });
    const json = JSON.stringify(b);
    expect(json).not.toContain(FAKE_NAME);
    expect(json).not.toContain(FAKE_NICK);
    expect(b.personal).toBeUndefined();
    expect(b.assets).toBeUndefined();
  });

  it('round-trips sessions, trials, opt-in identifiers and media', async () => {
    const t = trial({ sessionId: 's1' });
    const asset = { id: 'img', kind: 'image' as const, label: 'l', mime: 'image/png', blob: new Blob([new Uint8Array([1, 2, 3])], { type: 'image/png' }), createdAt: 1 };
    const b = await buildBackup({ settings: DEFAULT_SETTINGS, sessions: [session], trials: [t], personal, assets: [asset], includeIdentifiers: true, includeMedia: true, now: 1 });
    const parsed = parseBackup(JSON.stringify(b));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.sessions).toEqual([session]);
    expect(parsed.trials).toEqual([t]);
    expect(parsed.personal?.firstName).toBe(FAKE_NAME);
    expect(new Uint8Array(await parsed.assets[0]!.blob.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('rejects foreign or newer-version files with a Hebrew message', () => {
    expect(parseBackup('nope')).toMatchObject({ ok: false });
    expect(parseBackup(JSON.stringify({ format: 'x' }))).toMatchObject({ ok: false });
    const r = parseBackup(JSON.stringify({ format: 'leftward-backup', version: 999, sessions: [], trials: [] }));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.errorHe).toMatch(/[א-ת]/);
  });

  it('CSV has Hebrew headers, BOM, and no identifiers', () => {
    const csv = trialsToCsv([session], [trial({ sessionId: 's1' })]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('צד המטרה');
    expect(csv).toContain('הפניה בלי רמז');
  });

  it('clinician report is labelled as caregiver observations, not a clinical measure', () => {
    const html = buildClinicianReport([session], [trial({ sessionId: 's1' })], 1);
    expect(html).toContain('תצפיות');
    expect(html).toContain('אינו מדד קליני תקני');
    expect(html).toContain('dir="rtl"');
  });
});

describe('name validation', () => {
  it('accepts Hebrew names and nicknames with geresh', () => {
    expect(validateName('  בדיקה  ')).toEqual({ ok: true, value: 'בדיקה' });
    expect(validateName("ג'ו")).toMatchObject({ ok: true });
  });
  it('rejects empty, long, markup and URLs', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('א'.repeat(31)).ok).toBe(false);
    expect(validateName('<b>').ok).toBe(false);
    expect(validateName('http://x.y').ok).toBe(false);
  });
});

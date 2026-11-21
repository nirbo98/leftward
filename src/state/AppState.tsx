import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { initRunner, runnerReducer, type RunnerAction, type RunnerState } from '../domain/runner';
import { newId } from '../domain/rng';
import type { DeviceClass, EndReason, ExerciseId, SessionRecord, StimulusAsset, TrialParams, TrialRecord, VisionContext, Readiness } from '../domain/types';
import * as db from '../storage/db';
import { DEFAULT_PERSONAL, DEFAULT_SETTINGS, type AppSettings, type PersonalCueSettings } from '../storage/settings';

export function detectDeviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'unknown';
  const nav = navigator as Navigator & { maxTouchPoints?: number };
  const touch = (nav.maxTouchPoints ?? 0) > 1;
  const ua = nav.userAgent || '';
  const isIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && touch);
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (isIPad || (touch && Math.min(w, h) >= 600)) return w >= h ? 'tablet-landscape' : 'tablet-portrait';
  if (touch && Math.min(w, h) < 600) return 'phone';
  return 'desktop';
}

export function useSystemReducedMotion(): boolean {
  const [v, setV] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setV(mq.matches);
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return v;
}

export interface ActiveSession {
  record: SessionRecord;
}

interface AppCtx {
  ready: boolean;
  storageError: boolean;
  settings: AppSettings;
  personal: PersonalCueSettings;
  assets: StimulusAsset[];
  photoUrls: Record<string, string>;
  sessions: SessionRecord[];
  trials: TrialRecord[];
  reducedMotion: boolean;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  updatePersonal: (patch: Partial<PersonalCueSettings>) => Promise<void>;
  addAsset: (a: StimulusAsset) => Promise<void>;
  removeAsset: (id: string) => Promise<void>;
  refreshHistory: () => Promise<void>;
  reloadAll: () => Promise<void>;
  eraseAll: () => Promise<void>;
  // Session
  session: SessionRecord | null;
  runner: RunnerState | null;
  dispatch: (a: RunnerAction) => void;
  beginSession: (args: { readiness: Readiness; vision: VisionContext; exercise: ExerciseId; params: TrialParams; description?: string }) => Promise<void>;
  recordRestOnly: (args: { readiness: Readiness; vision: VisionContext }) => Promise<void>;
  updateSession: (patch: Partial<SessionRecord>) => Promise<void>;
  endSession: (reason: EndReason) => Promise<void>;
  clearSession: () => void;
}

const Ctx = createContext<AppCtx | null>(null);

export function useApp(): AppCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error('useApp outside provider');
  return c;
}

function nullableReducer(s: RunnerState | null, a: RunnerAction | { type: '__SET'; state: RunnerState | null }): RunnerState | null {
  if (a.type === '__SET') return a.state;
  return s ? runnerReducer(s, a) : s;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [personal, setPersonal] = useState<PersonalCueSettings>(DEFAULT_PERSONAL);
  const [assets, setAssets] = useState<StimulusAsset[]>([]);
  const [sessions, setSessions] = useState<SessionRecord[]>([]);
  const [trials, setTrials] = useState<TrialRecord[]>([]);
  const [session, setSession] = useState<SessionRecord | null>(null);
  const [runner, rawDispatch] = useReducer(nullableReducer, null);
  const sysReduced = useSystemReducedMotion();

  const reloadAll = useCallback(async () => {
    try {
      const [s, p, a, ss, tt] = await Promise.all([db.getSettings(), db.getPersonal(), db.listAssets(), db.listSessions(), db.listTrials()]);
      setSettings(s);
      setPersonal(p);
      setAssets(a);
      setSessions(ss);
      setTrials(tt);
      setStorageError(false);
    } catch {
      setStorageError(true);
    } finally {
      setReady(true);
    }
  }, []);

  useEffect(() => {
    void reloadAll();
  }, [reloadAll]);

  // Object URLs for local photos (revoked on change).
  const photoUrls = useMemo(() => {
    const m: Record<string, string> = {};
    for (const a of assets) if (a.kind === 'image') m[a.id] = URL.createObjectURL(a.blob);
    return m;
  }, [assets]);
  useEffect(() => () => Object.values(photoUrls).forEach((u) => URL.revokeObjectURL(u)), [photoUrls]);

  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const personalRef = useRef(personal);
  personalRef.current = personal;

  const updateSettings = useCallback(async (patch: Partial<AppSettings>) => {
    const next = { ...settingsRef.current, ...patch };
    settingsRef.current = next;
    setSettings(next);
    await db.saveSettings(next);
  }, []);
  const updatePersonal = useCallback(async (patch: Partial<PersonalCueSettings>) => {
    const next = { ...personalRef.current, ...patch };
    personalRef.current = next;
    setPersonal(next);
    await db.savePersonal(next);
  }, []);
  const addAsset = useCallback(async (a: StimulusAsset) => {
    await db.putAsset(a);
    setAssets((xs) => [...xs.filter((x) => x.id !== a.id), a]);
  }, []);
  const removeAsset = useCallback(async (id: string) => {
    await db.deleteAsset(id);
    setAssets((xs) => xs.filter((x) => x.id !== id));
    const s = settingsRef.current;
    if (s.selectedPhotoIds.includes(id)) await updateSettings({ selectedPhotoIds: s.selectedPhotoIds.filter((x) => x !== id) });
  }, [updateSettings]);
  const refreshHistory = useCallback(async () => {
    const [ss, tt] = await Promise.all([db.listSessions(), db.listTrials()]);
    setSessions(ss);
    setTrials(tt);
  }, []);

  const sessionRef = useRef(session);
  sessionRef.current = session;

  const beginSession: AppCtx['beginSession'] = useCallback(async ({ readiness, vision, exercise, params, description }) => {
    const rec: SessionRecord = {
      id: newId('s-'),
      startedAt: Date.now(),
      deviceClass: detectDeviceClass(),
      readiness,
      vision,
      plannedExercise: exercise,
      description,
      pauseCount: 0,
    };
    await db.putSession(rec);
    setSession(rec);
    rawDispatch({
      type: '__SET',
      state: initRunner({ sessionId: rec.id, exercise, params, seed: Math.floor(Math.random() * 1e9), soundEnabled: settingsRef.current.sound.enabled }),
    });
  }, []);

  const recordRestOnly: AppCtx['recordRestOnly'] = useCallback(async ({ readiness, vision }) => {
    const now = Date.now();
    const rec: SessionRecord = {
      id: newId('s-'),
      startedAt: now,
      endedAt: now,
      deviceClass: detectDeviceClass(),
      readiness,
      vision,
      plannedExercise: 'guided_orienting',
      endReason: 'not_fit',
      pauseCount: 0,
    };
    await db.putSession(rec);
    await refreshHistory();
  }, [refreshHistory]);

  const updateSession = useCallback(async (patch: Partial<SessionRecord>) => {
    const cur = sessionRef.current;
    if (!cur) return;
    const next = { ...cur, ...patch };
    sessionRef.current = next;
    setSession(next);
    await db.putSession(next);
  }, []);

  const endSession = useCallback(async (reason: EndReason) => {
    await updateSession({ endedAt: Date.now(), endReason: reason });
    await refreshHistory();
  }, [updateSession, refreshHistory]);

  const clearSession = useCallback(() => {
    setSession(null);
    rawDispatch({ type: '__SET', state: null });
  }, []);

  // Persist trial records as they are recorded / undone.
  const runnerRef = useRef(runner);
  const dispatch = useCallback((a: RunnerAction) => {
    rawDispatch(a);
  }, []);
  useEffect(() => {
    const prev = runnerRef.current;
    runnerRef.current = runner;
    if (!runner) return;
    if (runner.lastUndoneRecordId) void db.deleteTrial(runner.lastUndoneRecordId);
    const prevIds = new Set(prev?.completed.map((r) => r.id) ?? []);
    for (const r of runner.completed) if (!prevIds.has(r.id)) void db.putTrial(r);
    if (prev && runner.phase === 'paused' && prev.phase !== 'paused' && sessionRef.current) {
      void updateSession({ pauseCount: sessionRef.current.pauseCount + 1 });
    }
  }, [runner, updateSession]);

  const eraseAll = useCallback(async () => {
    await db.eraseAllData();
    setSession(null);
    rawDispatch({ type: '__SET', state: null });
    setSettings(DEFAULT_SETTINGS);
    setPersonal(DEFAULT_PERSONAL);
    setAssets([]);
    setSessions([]);
    setTrials([]);
  }, []);

  const value: AppCtx = {
    ready,
    storageError,
    settings,
    personal,
    assets,
    photoUrls,
    sessions,
    trials,
    reducedMotion: settings.reduceMotion === 'always' || sysReduced,
    updateSettings,
    updatePersonal,
    addAsset,
    removeAsset,
    refreshHistory,
    reloadAll,
    eraseAll,
    session,
    runner,
    dispatch,
    beginSession,
    recordRestOnly,
    updateSession,
    endSession,
    clearSession,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

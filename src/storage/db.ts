/**
 * Local-only persistence (IndexedDB via `idb`). Nothing here talks to a network.
 * Data are per device and per browser profile; there is no sync.
 */
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { SessionRecord, StimulusAsset, TrialRecord } from '../domain/types';
import { normalizePersonal, normalizeSettings, type AppSettings, type PersonalCueSettings } from './settings';

export const DB_NAME = 'leftward';
export const DB_VERSION = 1;

interface LeftwardDB extends DBSchema {
  kv: { key: string; value: unknown };
  sessions: { key: string; value: SessionRecord; indexes: { byStart: number } };
  trials: { key: string; value: TrialRecord; indexes: { bySession: string } };
  assets: { key: string; value: StimulusAsset };
}

let dbPromise: Promise<IDBPDatabase<LeftwardDB>> | null = null;

function db(): Promise<IDBPDatabase<LeftwardDB>> {
  if (!dbPromise) {
    dbPromise = openDB<LeftwardDB>(DB_NAME, DB_VERSION, {
      upgrade(d, oldVersion) {
        // Versioned, additive migrations. Add `if (oldVersion < 2) {...}` for future changes.
        if (oldVersion < 1) {
          d.createObjectStore('kv');
          d.createObjectStore('sessions', { keyPath: 'id' }).createIndex('byStart', 'startedAt');
          d.createObjectStore('trials', { keyPath: 'id' }).createIndex('bySession', 'sessionId');
          d.createObjectStore('assets', { keyPath: 'id' });
        }
      },
      blocking(_current, _blocked, event) {
        // Another tab (or an erase) wants to upgrade/delete: release THIS connection.
        (event.target as IDBDatabase).close();
        dbPromise = null;
      },
    });
  }
  return dbPromise;
}

export async function getSettings(): Promise<AppSettings> {
  return normalizeSettings(await (await db()).get('kv', 'settings'));
}
export async function saveSettings(s: AppSettings): Promise<void> {
  await (await db()).put('kv', s, 'settings');
}
export async function getPersonal(): Promise<PersonalCueSettings> {
  return normalizePersonal(await (await db()).get('kv', 'personal'));
}
export async function savePersonal(p: PersonalCueSettings): Promise<void> {
  await (await db()).put('kv', p, 'personal');
}

export async function putSession(s: SessionRecord): Promise<void> {
  await (await db()).put('sessions', s);
}
export async function listSessions(): Promise<SessionRecord[]> {
  return (await db()).getAllFromIndex('sessions', 'byStart');
}
export async function putTrial(t: TrialRecord): Promise<void> {
  await (await db()).put('trials', t);
}
export async function deleteTrial(id: string): Promise<void> {
  await (await db()).delete('trials', id);
}
export async function listTrials(): Promise<TrialRecord[]> {
  const all = await (await db()).getAll('trials');
  return all.sort((a, b) => a.startedAt - b.startedAt || a.index - b.index);
}
export async function deleteSession(id: string): Promise<void> {
  const d = await db();
  const tx = d.transaction(['sessions', 'trials'], 'readwrite');
  const keys = await tx.objectStore('trials').index('bySession').getAllKeys(id);
  await Promise.all([...keys.map((k) => tx.objectStore('trials').delete(k)), tx.objectStore('sessions').delete(id)]);
  await tx.done;
}

export async function putAsset(a: StimulusAsset): Promise<void> {
  await (await db()).put('assets', a);
}
export async function listAssets(): Promise<StimulusAsset[]> {
  return (await db()).getAll('assets');
}
export async function deleteAsset(id: string): Promise<void> {
  await (await db()).delete('assets', id);
}

/** Erase everything this app stored on this device (IndexedDB + local storage keys). */
export async function eraseAllData(): Promise<void> {
  if (dbPromise) {
    (await dbPromise).close();
    dbPromise = null;
  }
  await new Promise<void>((resolve, reject) => {
    const req = indexedDB.deleteDatabase(DB_NAME);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
    req.onblocked = () => resolve(); // completes once other tabs close
  });
  try {
    for (const k of Object.keys(localStorage)) if (k.startsWith('leftward')) localStorage.removeItem(k);
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

/** Ask the browser to keep data from automatic eviction (best effort; Safari may decline). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}

/** Test helper: simulate a page reload (close and drop the cached connection). */
export function __resetDbHandleForTests(): void {
  const p = dbPromise;
  dbPromise = null;
  void p?.then((h) => h.close());
}

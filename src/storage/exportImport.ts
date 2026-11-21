/**
 * Local backup / export / restore. Files are produced in the browser and saved by the
 * user; nothing is uploaded. Personal identifiers (name/nickname) and family media
 * are EXCLUDED unless the caregiver explicitly opts in.
 */
import type { SessionRecord, StimulusAsset, TrialRecord } from '../domain/types';
import {
  CUE_DELIVERY_LABEL,
  CUE_LABEL,
  DEVICE_LABEL,
  END_REASON_LABEL,
  EXERCISE_NAME,
  READINESS_LABEL,
  RESPONSE_CLASS_LABEL,
  SIDE_NAME,
  VISION_LABEL,
  formatDate,
  ofN,
} from '../i18n/he';
import { countClasses } from '../domain/progress';
import { normalizePersonal, normalizeSettings, type AppSettings, type PersonalCueSettings } from './settings';

export const BACKUP_FORMAT = 'leftward-backup';
export const BACKUP_VERSION = 1;

interface SerializedAsset extends Omit<StimulusAsset, 'blob'> {
  dataBase64: string;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: number;
  noteHe: string;
  settings: AppSettings;
  sessions: SessionRecord[];
  trials: TrialRecord[];
  personal?: PersonalCueSettings;
  assets?: SerializedAsset[];
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < buf.length; i += chunk) bin += String.fromCharCode(...buf.subarray(i, i + chunk));
  return btoa(bin);
}

export function base64ToBlob(b64: string, mime: string): Blob {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

export async function buildBackup(args: {
  settings: AppSettings;
  sessions: SessionRecord[];
  trials: TrialRecord[];
  personal: PersonalCueSettings;
  assets: StimulusAsset[];
  includeIdentifiers: boolean;
  includeMedia: boolean;
  now: number;
}): Promise<BackupFile> {
  const file: BackupFile = {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: args.now,
    noteHe: 'גיבוי מקומי של תצפיות מלווה. אינו מדד קליני תקני. שמרו בזהירות.',
    settings: args.settings,
    sessions: args.sessions,
    trials: args.trials,
  };
  if (args.includeIdentifiers) file.personal = args.personal;
  if (args.includeMedia) {
    file.assets = await Promise.all(
      args.assets.map(async (a) => {
        const { blob, ...rest } = a;
        return { ...rest, dataBase64: await blobToBase64(blob) };
      }),
    );
  }
  return file;
}

export type ParsedBackup =
  | { ok: true; settings: AppSettings; sessions: SessionRecord[]; trials: TrialRecord[]; personal?: PersonalCueSettings; assets: StimulusAsset[] }
  | { ok: false; errorHe: string };

function isObj(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === 'object' && !Array.isArray(x);
}

export function parseBackup(text: string): ParsedBackup {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { ok: false, errorHe: 'הקובץ אינו קובץ גיבוי תקין.' };
  }
  if (!isObj(raw) || raw.format !== BACKUP_FORMAT) return { ok: false, errorHe: 'זה לא קובץ גיבוי של היישום.' };
  if (typeof raw.version !== 'number' || raw.version > BACKUP_VERSION) {
    return { ok: false, errorHe: 'הגיבוי נוצר בגרסה חדשה יותר. עדכנו את היישום ונסו שוב.' };
  }
  const sessions = Array.isArray(raw.sessions) ? raw.sessions.filter((s) => isObj(s) && typeof s.id === 'string' && typeof s.startedAt === 'number') : null;
  const trials = Array.isArray(raw.trials)
    ? raw.trials.filter((t) => isObj(t) && typeof t.id === 'string' && typeof t.sessionId === 'string' && isObj(t.observation) && Array.isArray(t.cues))
    : null;
  if (!sessions || !trials) return { ok: false, errorHe: 'חסרים נתונים בקובץ הגיבוי.' };
  const assets: StimulusAsset[] = [];
  if (Array.isArray(raw.assets)) {
    for (const a of raw.assets) {
      if (!isObj(a) || typeof a.id !== 'string' || typeof a.dataBase64 !== 'string' || typeof a.mime !== 'string') continue;
      if (a.kind !== 'image' && a.kind !== 'audio') continue;
      const { dataBase64, ...rest } = a as unknown as SerializedAsset;
      try {
        assets.push({ ...rest, blob: base64ToBlob(dataBase64, rest.mime) });
      } catch {
        /* skip corrupted asset */
      }
    }
  }
  return {
    ok: true,
    settings: normalizeSettings(raw.settings),
    sessions: sessions as unknown as SessionRecord[],
    trials: trials as unknown as TrialRecord[],
    personal: isObj(raw.personal) ? normalizePersonal(raw.personal) : undefined,
    assets,
  };
}

// ---------------------------------------------------------------------------
// CSV (Hebrew headers, UTF-8 BOM for Excel/Numbers). No identifiers.
// ---------------------------------------------------------------------------
function csvCell(v: string | number | boolean | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const OUTCOME_HE: Record<string, string> = {
  oriented: 'הפנה לכיוון המטרה',
  other_direction: 'הסתכל לכיוון אחר',
  no_response_observed: 'לא נצפתה תגובה',
  cannot_determine: 'לא ניתן לקבוע',
};
const MODALITY_HE: Record<string, string> = { eyes: 'עיניים', head: 'ראש', eyes_and_head: 'עיניים וראש', unclear_kind: 'לא ברור' };

export function trialsToCsv(sessions: SessionRecord[], trials: TrialRecord[]): string {
  const byId = new Map(sessions.map((s) => [s.id, s]));
  const header = [
    'תאריך מפגש', 'מכשיר', 'מצב בתחילת המפגש', 'בדיקת נראות', 'ניסיון', 'תרגול', 'צד המטרה',
    'מספר חפצים', 'רמזים לפי הסדר', 'מה נצפה', 'אופן התגובה', 'עיתוי ביחס לרמז', 'סיווג', 'נראה שזיהה',
    'עייפות', 'אי־נוחות', 'ראות לא טובה', 'ירידה בקשב', 'קול מופעל', 'הערה',
  ];
  const rows = trials.map((t) => {
    const s = byId.get(t.sessionId);
    const o = t.observation.outcome;
    return [
      s ? formatDate(s.startedAt) : '',
      s ? DEVICE_LABEL[s.deviceClass] : '',
      s ? READINESS_LABEL[s.readiness] : '',
      s ? VISION_LABEL[s.vision.preview] : '',
      t.index + 1,
      EXERCISE_NAME[t.exercise],
      SIDE_NAME[t.targetSide],
      t.itemCount,
      t.cues.map((c) => `${c.order}. ${CUE_LABEL[c.type]} (${CUE_DELIVERY_LABEL[c.delivery]}${c.validity === 'invalid' ? ', בצד הנגדי' : ''}${c.preTarget ? ', לפני הופעת המטרה' : ''})`).join(' | '),
      OUTCOME_HE[o.kind] ?? '',
      o.kind === 'oriented' ? MODALITY_HE[o.modality] : '',
      t.timing === 'no_cues_given' ? 'בלי רמז' : t.timing === 'before_first_cue' ? 'לפני הרמז הראשון (לפי המלווה)' : 'אחרי רמז',
      RESPONSE_CLASS_LABEL[t.responseClass],
      t.observation.identification === 'seemed_to_identify' ? 'כן' : t.observation.identification === 'not_sure' ? 'לא בטוח' : '',
      t.observation.flags.fatigue ? 'כן' : '',
      t.observation.flags.discomfort ? 'כן' : '',
      t.observation.flags.poorVisibility ? 'כן' : '',
      t.observation.flags.lostEngagement ? 'כן' : '',
      t.soundEnabled ? 'כן' : 'לא',
      t.observation.note ?? '',
    ].map(csvCell).join(',');
  });
  return '﻿' + [header.map(csvCell).join(','), ...rows].join('\r\n');
}

// ---------------------------------------------------------------------------
// Printable Hebrew report for the rehabilitation team. Clearly labelled.
// ---------------------------------------------------------------------------
function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

export function buildClinicianReport(sessions: SessionRecord[], trials: TrialRecord[], now: number): string {
  const rows = sessions
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((s) => {
      const t = trials.filter((x) => x.sessionId === s.id);
      const c = countClasses(t);
      const left = countClasses(t.filter((x) => x.targetSide === 'left'));
      return `<tr><td>${esc(formatDate(s.startedAt))}</td><td>${esc(DEVICE_LABEL[s.deviceClass])}</td><td>${esc(READINESS_LABEL[s.readiness])}</td>
<td>${esc(VISION_LABEL[s.vision.preview])}</td><td>${esc([...new Set(t.map((x) => EXERCISE_NAME[x.exercise]))].join(', '))}</td>
<td>${c.total}</td><td>${esc(ofN(left.spontaneous, left.interpretable))}</td><td>${esc(ofN(left.afterSpatialCue + left.afterNonspatialCue, left.interpretable))}</td>
<td>${c.cannotDetermine}</td><td>${s.endReason ? esc(END_REASON_LABEL[s.endReason]) : ''}</td><td>${esc(s.clinicianReviewNotes ?? s.notes ?? '')}</td></tr>`;
    })
    .join('\n');
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>סיכום תצפיות מלווה</title>
<style>body{font-family:system-ui,-apple-system,sans-serif;margin:2rem;line-height:1.5}table{border-collapse:collapse;width:100%}td,th{border:1px solid #999;padding:.4rem;text-align:right;vertical-align:top}th{background:#eee}.warn{border:2px solid #b45309;padding:1rem;margin:1rem 0}</style></head><body>
<h1>סיכום תצפיות מלווה</h1>
<p>הופק: ${esc(formatDate(now))}</p>
<div class="warn"><strong>חשוב:</strong> אלה תצפיות שהזין בן משפחה במהלך תרגול ביתי. זה אינו מדד קליני תקני, אינו מעריך הזנחה (neglect) ואינו מחליף הערכה של צוות השיקום. היישום אינו עוקב אחרי מבט. ייתכן שעייפות, ראייה לא מתוקנת, תנוחה ומכשיר שונה משפיעים על התצפיות. מספרים קטנים אינם מאפשרים מסקנות.</div>
<table><thead><tr><th>תאריך</th><th>מכשיר</th><th>מצב</th><th>נראות</th><th>תרגולים</th><th>ניסיונות</th><th>מטרה בשמאל: הפניה בלי רמז (מתוך ניסיונות שניתן לפרש)</th><th>מטרה בשמאל: הפניה אחרי רמז</th><th>לא ניתן לקבוע</th><th>סיום</th><th>הערות</th></tr></thead>
<tbody>${rows}</tbody></table>
<h2>פירוט רמזים</h2>
<p>${esc(Object.entries(trials.flatMap((t) => t.cues).reduce<Record<string, number>>((m, c) => ((m[CUE_LABEL[c.type]] = (m[CUE_LABEL[c.type]] ?? 0) + 1), m), {})).map(([k, v]) => `${k}: ${v}`).join(' · ') || 'לא נעשה שימוש ברמזים.')}</p>
</body></html>`;
}

export function downloadFile(name: string, content: string | Blob, mime: string): void {
  const blob = typeof content === 'string' ? new Blob([content], { type: mime }) : content;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function dateStamp(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

import { useMemo, useState } from 'react';
import { countClasses, summarize, type ClassCounts } from '../domain/progress';
import type { CueType, DeviceClass, ExerciseId, Readiness } from '../domain/types';
import { Btn, Notice, Page } from '../components/ui';
import { deleteSession } from '../storage/db';
import {
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
import { useApp } from '../state/AppState';
import { navigate } from '../state/router';

function Bar({ k, n, label }: { k: number; n: number; label: string }) {
  const pct = n > 0 ? (k / n) * 100 : 0;
  return (
    <div className="bar-row">
      <span className="bar-label">{label}</span>
      <span className="bar-track" aria-hidden="true">
        <span className="bar-fill" style={{ width: `${pct}%` }} />
      </span>
      <span className="bar-num">{ofN(k, n)}</span>
    </div>
  );
}

function CountsBlock({ c }: { c: ClassCounts }) {
  return (
    <div>
      <Bar k={c.spontaneous} n={c.interpretable} label={RESPONSE_CLASS_LABEL.spontaneous} />
      <Bar k={c.afterSpatialCue} n={c.interpretable} label={RESPONSE_CLASS_LABEL.after_spatial_cue} />
      <Bar k={c.afterNonspatialCue} n={c.interpretable} label={RESPONSE_CLASS_LABEL.after_nonspatial_cue} />
      <Bar k={c.noResponse} n={c.interpretable} label={RESPONSE_CLASS_LABEL.no_response_observed} />
      <Bar k={c.otherDirection} n={c.interpretable} label={RESPONSE_CLASS_LABEL.other_direction} />
      <p className="muted small">לא ניתן היה לקבוע (עייפות, חוסר בהירות, ראות): {c.cannotDetermine} — מוצגים כאן ולא נכללים במכנה.</p>
    </div>
  );
}

export function ProgressScreen() {
  const { sessions, trials, refreshHistory } = useApp();
  const [open, setOpen] = useState<string | null>(null);
  const s = useMemo(() => summarize(sessions, trials), [sessions, trials]);
  const sorted = [...sessions].sort((a, b) => b.startedAt - a.startedAt);
  const devices = Object.keys(s.byDevice) as DeviceClass[];

  return (
    <Page title="התקדמות" onBack={() => navigate('home')}>
      <Notice>
        כאן מוצגות התצפיות שתיעדתם, כפי שהן. זה לא ציון ולא מדד רפואי, ואין כאן ״אחוזי שיפור״. עייפות, ראייה, תנוחה ומכשיר אחר משנים את התמונה.
      </Notice>
      <p data-testid="progress-counts">מפגשים: {s.sessionCount} · ניסיונות מתועדים: {s.trialCount}</p>
      {s.trialCount === 0 ? (
        <p className="lead">עדיין אין תיעוד. אחרי המפגש הראשון תוכלו לראות כאן את התצפיות.</p>
      ) : (
        <>
          {s.smallSample && <Notice kind="warn">יש מעט ניסיונות. במספרים קטנים כל ניסיון משנה הרבה, ואי אפשר להסיק מגמה.</Notice>}
          <section className="card" data-testid="progress-left">
            <h2>מטרה בצד שמאל</h2>
            <p className="muted small">מתוך {s.leftTargets.interpretable} ניסיונות שניתן היה לפרש.</p>
            <CountsBlock c={s.leftTargets} />
          </section>

          <details className="card">
            <summary>לפי מצב בתחילת המפגש</summary>
            {(Object.keys(s.byReadiness) as Readiness[]).map((r) => (
              <div key={r}>
                <h3>{READINESS_LABEL[r]} ({s.byReadiness[r]!.total} ניסיונות)</h3>
                <CountsBlock c={s.byReadiness[r]!} />
              </div>
            ))}
          </details>

          <details className="card">
            <summary>לפי תרגול</summary>
            {(Object.keys(s.byExercise) as ExerciseId[]).map((e) => (
              <div key={e}>
                <h3>{EXERCISE_NAME[e]} ({s.byExercise[e]!.total} ניסיונות)</h3>
                <CountsBlock c={s.byExercise[e]!} />
              </div>
            ))}
          </details>

          {devices.length > 1 && (
            <details className="card">
              <summary>לפי מכשיר</summary>
              <p className="muted small">מסך בגודל ובמרחק שונים אינו בר־השוואה ישירה.</p>
              {devices.map((d) => (
                <p key={d}>{DEVICE_LABEL[d]}: {s.byDevice[d]!.total} ניסיונות</p>
              ))}
            </details>
          )}

          <details className="card">
            <summary>באילו רמזים השתמשתם</summary>
            <p>ניסיונות בלי שום רמז: {ofN(s.trialsWithoutAnyCue, s.trialCount)}</p>
            <ul className="plain-list">
              {(Object.keys(s.cueUse) as CueType[]).map((c) => (
                <li key={c}>{CUE_LABEL[c]}: {s.cueUse[c]} פעמים</li>
              ))}
            </ul>
          </details>

          {(s.alertComparison.withAlert.trials > 0 || s.alertComparison.withoutAlert.trials > 0) && (
            <details className="card" data-testid="alert-compare">
              <summary>״שים לב — ואז מטרה״: עם התראה ובלי התראה</summary>
              <Notice kind="warn">
                זו ספירה תיאורית בלבד. במחקר נמצא שהתראה לא־כיוונית יכולה לשפר זמנית את ההתייחסות לצד שמאל, אבל כאן אין ניסוי מבוקר, הניסיונות מעטים, ואי אפשר להסיק מזה שההתראה עוזרת לו.
              </Notice>
              <Bar k={s.alertComparison.withAlert.oriented} n={s.alertComparison.withAlert.interpretable} label="הפניה למטרה — עם התראה" />
              <Bar k={s.alertComparison.withoutAlert.oriented} n={s.alertComparison.withoutAlert.interpretable} label="הפניה למטרה — בלי התראה" />
              {s.alertComparison.excludedMixed > 0 && <p className="muted small">ניסיונות שבהם ניתן גם רמז אחרי הופעת המטרה לא נכללו: {s.alertComparison.excludedMixed}</p>}
            </details>
          )}

          <details className="card" data-testid="cue-compare">
            <summary>השוואה תיאורית בין סוגי רמזים</summary>
            <Notice kind="warn">
              זו רק ספירה. היא לא מראה שרמז אחד עדיף על אחר: הניסיונות לא נעשו בתנאים שווים, יש מעט מהם, ועייפות או מצב רוח משפיעים. אין כאן מבחן סטטיסטי.
            </Notice>
            <ul className="plain-list">
              {(Object.keys(s.byFirstCue) as CueType[]).map((c) => {
                const e = s.byFirstCue[c]!;
                return (
                  <li key={c}>
                    רמז ראשון ״{CUE_LABEL[c]}״: הפניה אחריו ב־{ofN(e.orientedAfter, e.interpretable)} ניסיונות שניתן היה לפרש
                  </li>
                );
              })}
            </ul>
          </details>
        </>
      )}

      <h2>מפגשים</h2>
      <ul className="session-list">
        {sorted.map((ss) => {
          const t = trials.filter((x) => x.sessionId === ss.id);
          const c = countClasses(t);
          return (
            <li key={ss.id} className="card tight" data-testid="session-item">
              <button type="button" className="link-like" aria-expanded={open === ss.id} onClick={() => setOpen(open === ss.id ? null : ss.id)}>
                {formatDate(ss.startedAt)} · {READINESS_LABEL[ss.readiness]} · {DEVICE_LABEL[ss.deviceClass]} · {c.total} ניסיונות
                {ss.endReason ? ` · ${END_REASON_LABEL[ss.endReason]}` : ''}
              </button>
              {open === ss.id && (
                <div>
                  <p className="muted small">בדיקת נראות: {VISION_LABEL[ss.vision.preview]}{ss.pauseCount ? ` · הפסקות: ${ss.pauseCount}` : ''}</p>
                  {ss.description && <p>תיאור: {ss.description}</p>}
                  {ss.notes && <p>הערות: {ss.notes}</p>}
                  <ol>
                    {t.map((x) => (
                      <li key={x.id}>
                        {EXERCISE_NAME[x.exercise]} · מטרה ב{SIDE_NAME[x.targetSide]} · {x.cues.length ? x.cues.map((cu) => CUE_LABEL[cu.type]).join(' ← ') : 'בלי רמז'} · <strong>{RESPONSE_CLASS_LABEL[x.responseClass]}</strong>
                      </li>
                    ))}
                  </ol>
                  <Btn
                    variant="danger"
                    onClick={async () => {
                      if (window.confirm('למחוק את המפגש הזה מהמכשיר?')) {
                        await deleteSession(ss.id);
                        await refreshHistory();
                      }
                    }}
                  >
                    מחיקת המפגש
                  </Btn>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      <Btn onClick={() => navigate('settings')}>ייצוא וגיבוי (בהגדרות)</Btn>
    </Page>
  );
}

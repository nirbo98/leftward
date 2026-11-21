import { useState } from 'react';
import { countClasses } from '../domain/progress';
import type { EndReason } from '../domain/types';
import { Btn, Choice, Notice, Page } from '../components/ui';
import { ACUTE_CHANGE_NOTE, END_REASON_LABEL, ofN } from '../i18n/he';
import { useApp } from '../state/AppState';
import { navigate } from '../state/router';

const TRANSFER_IDEAS = [
  'הניחו תמונה מוכרת או חפץ אהוב בצד שמאל שלו, בטווח הראייה, ושאלו אם הוא רואה אותו.',
  'בן משפחה מתיישב בצד שמאל שלו ומדבר איתו, בלי לבקש ממנו לזוז.',
  'בזמן צפייה בטלוויזיה או בתמונות, הצביעו על משהו בצד שמאל של המסך.',
];

export function EndScreen() {
  const { runner, session, endSession, updateSession, clearSession, refreshHistory } = useApp();
  const [reason, setReason] = useState<EndReason | null>(session?.endReason ?? null);
  const [transfer, setTransfer] = useState<'none' | 'done' | 'skipped'>('none');
  const [notes, setNotes] = useState('');

  if (!session || !runner) {
    return (
      <Page title="אין מפגש פתוח" onBack={() => navigate('home')}>
        <Btn variant="primary" onClick={() => navigate('home')}>חזרה למסך הראשי</Btn>
      </Page>
    );
  }

  if (!reason) {
    return (
      <Page title="סיום התרגול" onBack={() => navigate('exercise')} backLabel="חזרה לתרגול">
        <p>למה מסיימים? (עוזר להבין את התיעוד בהמשך)</p>
        <div className="stack">
          {(['completed', 'fatigue', 'discomfort', 'caregiver_choice'] as EndReason[]).map((r) => (
            <Btn key={r} big data-testid={`end-reason-${r}`} onClick={async () => { setReason(r); await endSession(r); }}>
              {END_REASON_LABEL[r]}
            </Btn>
          ))}
        </div>
      </Page>
    );
  }

  const c = countClasses(runner.completed);
  const left = countClasses(runner.completed.filter((t) => t.targetSide === 'left'));
  const offerTransfer = reason !== 'discomfort';

  return (
    <Page title="סיכום קצר">
      {reason === 'discomfort' && <Notice kind="safety">{ACUTE_CHANGE_NOTE}</Notice>}
      <section className="card" data-testid="session-summary">
        <p>תועדו {c.total} ניסיונות.</p>
        {left.total > 0 && (
          <ul className="plain-list">
            <li>מטרה בצד שמאל — הפניה בלי רמז: <strong>{ofN(left.spontaneous, left.interpretable)}</strong> ניסיונות שניתן היה לפרש</li>
            <li>הפניה אחרי רמז: {ofN(left.afterSpatialCue + left.afterNonspatialCue, left.interpretable)}</li>
            <li>לא נצפתה תגובה: {ofN(left.noResponse, left.interpretable)}</li>
            <li>לא ניתן היה לקבוע (לא נכלל בחישוב): {left.cannotDetermine}</li>
          </ul>
        )}
        <p className="muted">אלה תצפיות שלכם מהיום, לא ציון. מספרים קטנים משתנים בקלות בגלל עייפות, ראייה ותנוחה.</p>
      </section>

      {offerTransfer && (
        <section className="card" aria-labelledby="transfer-title" data-testid="transfer-card">
          <h2 id="transfer-title">רגע מהחיים (לא חובה)</h2>
          <p>אם זה נוח לו עכשיו, אפשר לנסות דבר אחד פשוט, בתנוחה שבה הוא נמצא:</p>
          <ul className="plain-list">
            {TRANSFER_IDEAS.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <Notice kind="warn">בלי לעמוד, ללכת, לאכול או לשתות לצורך התרגול, בלי להזיז את היד או הכתף, ובלי לגעת בציוד רפואי.</Notice>
          <div className="row wrap">
            <Choice selected={transfer === 'done'} onClick={() => setTransfer('done')} data-testid="transfer-done">ניסינו</Choice>
            <Choice selected={transfer === 'skipped'} onClick={() => setTransfer('skipped')} data-testid="transfer-skip">דילגנו</Choice>
          </div>
        </section>
      )}

      <label className="field">
        <span>הערות למפגש (לא חובה)</span>
        <textarea value={notes} maxLength={1000} onChange={(e) => setNotes(e.target.value)} data-testid="session-notes" />
      </label>

      <div className="row wrap">
        <Btn
          variant="primary"
          big
          data-testid="finish-session"
          onClick={async () => {
            await updateSession({ notes: notes.trim() || session.notes, transfer: offerTransfer ? { offered: true, done: transfer === 'done' } : { offered: false, done: false } });
            await refreshHistory();
            clearSession();
            navigate('progress');
          }}
        >
          שמירה וצפייה בהתקדמות
        </Btn>
        <Btn
          onClick={async () => {
            await updateSession({ notes: notes.trim() || session.notes, transfer: offerTransfer ? { offered: true, done: transfer === 'done' } : { offered: false, done: false } });
            await refreshHistory();
            clearSession();
            navigate('home');
          }}
        >
          שמירה וחזרה למסך הראשי
        </Btn>
      </div>
    </Page>
  );
}

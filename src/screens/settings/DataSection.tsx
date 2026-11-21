import { useState } from 'react';
import { Btn, Notice, Toggle } from '../../components/ui';
import * as db from '../../storage/db';
import { buildBackup, buildClinicianReport, dateStamp, downloadFile, parseBackup, trialsToCsv } from '../../storage/exportImport';
import { useApp } from '../../state/AppState';

export function DataSection() {
  const app = useApp();
  const [includeIds, setIncludeIds] = useState(false);
  const [includeMedia, setIncludeMedia] = useState(false);
  const [importPersonal, setImportPersonal] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [confirmErase, setConfirmErase] = useState(false);

  return (
    <div className="stack">
      <Notice>
        כל המידע נשמר רק במכשיר הזה ובדפדפן הזה. אין סנכרון אוטומטי בין המחשב לאייפד. כדי להעביר — שמרו גיבוי במכשיר אחד, העבירו את הקובץ (למשל באיירדרופ או בדוא״ל), ופתחו אותו כאן במכשיר השני דרך ״שחזור מגיבוי״.
      </Notice>

      <h3>גיבוי וייצוא</h3>
      <Toggle checked={includeIds} onChange={setIncludeIds} label="לכלול שם וכינוי בגיבוי" hint="כבוי כברירת מחדל. קובץ שמור אפשר להעביר הלאה — שמרו אותו בזהירות." testId="export-include-ids" />
      <Toggle checked={includeMedia} onChange={setIncludeMedia} label="לכלול תמונות וקבצי קול בגיבוי" hint="הקובץ יהיה גדול יותר ויכיל מדיה משפחתית." />
      <div className="row wrap">
        <Btn
          variant="primary"
          data-testid="export-backup"
          onClick={async () => {
            const [sessions, trials, assets] = await Promise.all([db.listSessions(), db.listTrials(), db.listAssets()]);
            const b = await buildBackup({ settings: app.settings, sessions, trials, personal: app.personal, assets, includeIdentifiers: includeIds, includeMedia, now: Date.now() });
            downloadFile(`leftward-backup-${dateStamp(Date.now())}.json`, JSON.stringify(b), 'application/json');
            setMsg('קובץ הגיבוי נוצר.');
          }}
        >
          שמירת גיבוי (קובץ)
        </Btn>
        <Btn
          data-testid="export-csv"
          onClick={async () => {
            const [sessions, trials] = await Promise.all([db.listSessions(), db.listTrials()]);
            downloadFile(`leftward-export-${dateStamp(Date.now())}.csv`, trialsToCsv(sessions, trials), 'text/csv;charset=utf-8');
          }}
        >
          טבלה לגיליון אלקטרוני
        </Btn>
        <Btn
          data-testid="export-report"
          onClick={async () => {
            const [sessions, trials] = await Promise.all([db.listSessions(), db.listTrials()]);
            downloadFile(`leftward-report-${dateStamp(Date.now())}.html`, buildClinicianReport(sessions, trials, Date.now()), 'text/html;charset=utf-8');
          }}
        >
          סיכום לצוות המטפל
        </Btn>
      </div>
      <p className="small">הטבלה והסיכום לא כוללים שם או כינוי. הסיכום מסומן כתצפיות של המשפחה, לא כמדד קליני.</p>

      <h3>שחזור מגיבוי</h3>
      <Toggle checked={importPersonal} onChange={setImportPersonal} label="לייבא גם שם/כינוי אם הם בקובץ" />
      <label className="file-btn">
        <span>בחירת קובץ גיבוי</span>
        <input
          type="file"
          accept="application/json,.json"
          data-testid="import-file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const parsed = parseBackup(await f.text());
            if (!parsed.ok) return setMsg(parsed.errorHe);
            for (const s of parsed.sessions) await db.putSession(s);
            for (const t of parsed.trials) await db.putTrial(t);
            for (const a of parsed.assets) await db.putAsset(a);
            if (importPersonal && parsed.personal) await db.savePersonal(parsed.personal);
            await app.reloadAll();
            setMsg(`שוחזרו ${parsed.sessions.length} מפגשים ו־${parsed.trials.length} ניסיונות. מפגשים שכבר היו במכשיר לא שוכפלו.`);
          }}
        />
      </label>

      <h3>שמירה קבועה</h3>
      <Btn onClick={async () => setMsg((await db.requestPersistentStorage()) ? 'הדפדפן אישר שמירה קבועה.' : 'הדפדפן לא אישר. מומלץ לשמור גיבוי מדי פעם.')}>בקשה מהדפדפן לא למחוק את הנתונים</Btn>
      <p className="small">ניקוי היסטוריית הדפדפן או נתוני אתרים ימחק את המידע. בדפדפן ספארי, מידע של אתר שלא נפתח זמן רב עלול להימחק — לכן כדאי להוסיף את היישום למסך הבית ולשמור גיבוי.</p>

      <h3>מחיקה</h3>
      {!confirmErase ? (
        <Btn variant="danger" onClick={() => setConfirmErase(true)} data-testid="erase-all">מחקו את כל הנתונים במכשיר הזה</Btn>
      ) : (
        <Notice kind="warn" role="alert">
          <p>זה ימחק את כל התיעוד, השם והכינוי, התמונות וקבצי הקול מהמכשיר הזה. אי אפשר לבטל.</p>
          <div className="row wrap">
            <Btn
              variant="danger"
              data-testid="erase-confirm"
              onClick={async () => {
                await app.eraseAll();
                setConfirmErase(false);
                setMsg('כל הנתונים נמחקו מהמכשיר הזה.');
              }}
            >
              כן, למחוק הכול
            </Btn>
            <Btn onClick={() => setConfirmErase(false)}>ביטול</Btn>
          </div>
        </Notice>
      )}
      {msg && <p role="status" data-testid="data-msg">{msg}</p>}
    </div>
  );
}

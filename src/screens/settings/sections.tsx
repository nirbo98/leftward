import { useState } from 'react';
import { newId } from '../../domain/rng';
import type { CueType, StimulusTheme } from '../../domain/types';
import { SIZE_ORDER } from '../../domain/types';
import { Glyph, CAR_GLYPHS, WATCH_GLYPHS } from '../../components/Glyph';
import { PALETTE } from '../../components/PatientStage';
import { Btn, Choice, Notice, Toggle } from '../../components/ui';
import { playTone, stopAll } from '../../services/audio';
import { CUE_LABEL, SIZE_LABEL, THEME_LABEL } from '../../i18n/he';
import { useApp } from '../../state/AppState';

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

export function SoundSettings() {
  const { settings, updateSettings } = useApp();
  const s = settings.sound;
  const [msg, setMsg] = useState<string | null>(null);
  const upd = (patch: Partial<typeof s>) => void updateSettings({ sound: { ...s, ...patch } });
  return (
    <div className="stack">
      <p>הקול כבוי כברירת מחדל. גם כשהוא מופעל, שום צליל לא מושמע לבד — רק כשלוחצים על כפתור. אפשר לתרגל לגמרי בלי קול.</p>
      <Toggle checked={s.enabled} onChange={(v) => { if (!v) stopAll(); upd({ enabled: v }); }} label="הפעלת קול" testId="sound-enable" />
      <label className="field">
        <span>עוצמה (מתחילה נמוך): {Math.round(s.volume * 100)}</span>
        <input type="range" min={0.05} max={1} step={0.05} value={s.volume} disabled={!s.enabled} onChange={(e) => upd({ volume: Number(e.target.value) })} />
      </label>
      <Btn
        disabled={!s.enabled}
        onClick={async () => setMsg((await playTone({ volume: s.volume })) ? 'הושמע צליל קצר. בדקו שהעוצמה נעימה במכשיר ובמקום הזה.' : 'לא ניתן להשמיע צליל במכשיר הזה (אולי מצב שקט).')}
        data-testid="sound-test"
      >
        בדיקת עוצמה
      </Btn>
      {msg && <p role="status">{msg}</p>}
      <details>
        <summary>צליל מכיוון אחד (מתקדם)</summary>
        <p className="small">רמקולים של מחשב נייד או טאבלט לא תמיד מאפשרים לשמוע מאיזה צד מגיע הצליל. זה לא מוכח כעוזר. השאירו כבוי אלא אם בדקתם שהכיוון מורגש.</p>
        <div className="row wrap">
          <Btn disabled={!s.enabled} onClick={() => void playTone({ volume: s.volume, pan: -1 })}>צליל משמאל</Btn>
          <Btn disabled={!s.enabled} onClick={() => void playTone({ volume: s.volume, pan: 1 })}>צליל מימין</Btn>
        </div>
        <Toggle checked={s.panVerified} disabled={!s.enabled} onChange={(v) => upd({ panVerified: v, panEnabled: v ? s.panEnabled : false })} label="בדקתי ששומעים בבירור את ההבדל בין הצדדים" />
        <Toggle checked={s.panEnabled} disabled={!s.panVerified} onChange={(v) => upd({ panEnabled: v })} label="להשמיע צליל ניטרלי מכיוון המטרה" />
      </details>
    </div>
  );
}

export function StimulusSettings() {
  const { settings, updateSettings, assets, addAsset, removeAsset, photoUrls } = useApp();
  const pal = PALETTE[settings.contrast];
  const images = assets.filter((a) => a.kind === 'image');
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="stack">
      <p>מומלץ להתחיל בצורות פשוטות וגדולות. מכוניות ושעונים עשויים לעניין אותו, אבל אין הוכחה שהם עוזרים יותר. אם קשה לראות — חזרו לצורות.</p>
      <div className="row wrap">
        {(['shapes', 'cars', 'watches', 'photos'] as StimulusTheme[]).map((t) => (
          <Choice key={t} selected={settings.preferredTheme === t} disabled={t === 'photos' && settings.selectedPhotoIds.length === 0} onClick={() => void updateSettings({ preferredTheme: t })} data-testid={`theme-${t}`}>
            {THEME_LABEL[t]}
          </Choice>
        ))}
      </div>
      <div className="glyph-preview" dir="ltr" style={{ background: pal.bg }}>
        {['disc', ...CAR_GLYPHS, ...WATCH_GLYPHS].map((g) => (
          <div key={g} className="glyph-cell"><Glyph glyph={g} fg={pal.fg} bg={pal.bg} label="" /></div>
        ))}
      </div>
      <div className="row wrap">
        <span>רקע:</span>
        <Choice selected={settings.contrast === 'high_dark'} onClick={() => void updateSettings({ contrast: 'high_dark' })}>כהה עם צהוב</Choice>
        <Choice selected={settings.contrast === 'high_light'} onClick={() => void updateSettings({ contrast: 'high_light' })}>בהיר עם שחור</Choice>
      </div>
      <div className="row wrap">
        <span>גודל ברירת מחדל:</span>
        {SIZE_ORDER.map((s) => (
          <Choice key={s} selected={settings.defaultSize === s} onClick={() => void updateSettings({ defaultSize: s })}>{SIZE_LABEL[s]}</Choice>
        ))}
      </div>

      <h3>תמונות מהמשפחה (לא חובה)</h3>
      <p className="small">תמונה של חפץ מוכר — למשל מכונית או שעון שלו. התמונות נשמרות רק במכשיר הזה. עדיף תמונה פשוטה עם חפץ אחד גדול ורקע שקט. אל תעלו תמונות של המטופל עצמו, ושימו לב לזכויות יוצרים.</p>
      <label className="file-btn">
        <span>הוספת תמונה מהמכשיר</span>
        {/* No `capture` attribute: selects an existing image only; never opens the camera for the patient. */}
        <input
          type="file"
          accept="image/*"
          data-testid="image-file"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            if (!f.type.startsWith('image/')) return setMsg('זה לא קובץ תמונה.');
            if (f.size > MAX_IMAGE_BYTES) return setMsg('התמונה גדולה מדי (עד 8 מגה־בייט).');
            const id = newId('i-');
            await addAsset({ id, kind: 'image', label: 'תמונה', mime: f.type, blob: f, createdAt: Date.now() });
            await updateSettings({ selectedPhotoIds: [...settings.selectedPhotoIds, id] });
            setMsg('התמונה נשמרה במכשיר.');
          }}
        />
      </label>
      {msg && <p role="status">{msg}</p>}
      <div className="photo-grid">
        {images.map((a) => (
          <div key={a.id} className="photo-cell">
            {photoUrls[a.id] && <img src={photoUrls[a.id]} alt="תמונה מקומית" />}
            <Toggle
              checked={settings.selectedPhotoIds.includes(a.id)}
              onChange={(v) => void updateSettings({ selectedPhotoIds: v ? [...settings.selectedPhotoIds, a.id] : settings.selectedPhotoIds.filter((x) => x !== a.id) })}
              label="להשתמש בתרגול"
            />
            <Btn variant="danger" onClick={() => void removeAsset(a.id)}>מחיקה</Btn>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MotionSettings() {
  const { settings, updateSettings, reducedMotion } = useApp();
  return (
    <div className="stack">
      <Toggle
        checked={settings.reduceMotion === 'always'}
        onChange={(v) => void updateSettings({ reduceMotion: v ? 'always' : 'system' })}
        label="הפחתת תנועה תמיד"
        hint={reducedMotion && settings.reduceMotion === 'system' ? 'המכשיר כבר מבקש הפחתת תנועה — התנועה כבויה.' : 'כשמופעל, אין שום תנועה במסך התרגול.'}
      />
      <p className="small">אין ביישום הבהובים, ספירה לאחור או צלילים פתאומיים.</p>
    </div>
  );
}

const LADDER_OPTIONS: CueType[] = ['visual', 'verbal_left', 'name_plus_left', 'neutral_tone', 'other'];

export function AdvancedSettings() {
  const { settings, updateSettings } = useApp();
  const ladder = settings.cueLadder;
  return (
    <div className="stack">
      <Toggle checked={settings.advancedMode} onChange={(v) => void updateSettings({ advancedMode: v })} label="הצגת אפשרויות מתקדמות בתחילת תרגול" hint="בחירה ידנית של תרגול, מיקום, גודל, רמזים ותנועה." testId="advanced-mode" />
      <Toggle
        checked={settings.pursuitApprovedByClinician}
        onChange={(v) => void updateSettings({ pursuitApprovedByClinician: v })}
        label="צוות השיקום אישר תרגול עם חפצים שנעים לאט"
        hint="רק לאחר אישור. אין תנועה מהירה או הבהובים."
      />
      <Toggle
        checked={settings.allowInvalidCues}
        onChange={(v) => void updateSettings({ allowInvalidCues: v })}
        label="לאפשר רמז בצד הנגדי (מתקדם, השראה מניסויי מחקר)"
        hint="כבוי כברירת מחדל. אינו נדרש לתרגול ביתי, ואינו מודד קשב."
      />
      <fieldset className="fieldset">
        <legend>סדר ״עזרה נוספת״</legend>
        <p className="small">כל לחיצה על ״עזרה נוספת״ מוסיפה את הרמז הבא ברשימה. שם לבד (בלי כיוון) לעולם לא מתווסף אוטומטית.</p>
        <ol>
          {ladder.map((c, i) => (
            <li key={c} className="row wrap">
              <span>{CUE_LABEL[c]}</span>
              <Btn variant="quiet" disabled={i === 0} onClick={() => { const n = [...ladder]; [n[i - 1], n[i]] = [n[i]!, n[i - 1]!]; void updateSettings({ cueLadder: n }); }} aria-label={`להקדים את ${CUE_LABEL[c]}`}>למעלה</Btn>
              <Btn variant="quiet" disabled={ladder.length === 1} onClick={() => void updateSettings({ cueLadder: ladder.filter((x) => x !== c) })}>הסרה</Btn>
            </li>
          ))}
        </ol>
        <div className="row wrap">
          {LADDER_OPTIONS.filter((c) => !ladder.includes(c)).map((c) => (
            <Btn key={c} variant="quiet" onClick={() => void updateSettings({ cueLadder: [...ladder, c] })}>הוספת {CUE_LABEL[c]}</Btn>
          ))}
        </div>
      </fieldset>
      <Notice>אפשרויות מתקדמות לא עוקפות את כללי הפרטיות: אין מצלמה, אין מיקרופון, אין הקלטה ואין שליחת מידע.</Notice>
    </div>
  );
}

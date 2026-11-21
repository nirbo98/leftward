import { useState } from 'react';
import { newId } from '../../domain/rng';
import type { StimulusAsset } from '../../domain/types';
import { Btn, Choice, Notice, Toggle } from '../../components/ui';
import { playBlob } from '../../services/audio';
import { checkTtsAvailability, runOfflineVerification, type TtsAvailability } from '../../services/tts';
import { validateName, type PersonalCueSettings, type PreferredAddress } from '../../storage/settings';
import { useApp } from '../../state/AppState';

const MAX_AUDIO_BYTES = 5 * 1024 * 1024;
const CLIP_LABEL: Record<NonNullable<StimulusAsset['mappedCue']>, string> = {
  first_name: 'שם פרטי',
  nickname: 'כינוי',
  name_plus_left: 'שם/כינוי + ״תסתכל שמאלה״',
  neutral: 'משפט ניטרלי',
};

export function PersonalCueManager() {
  const { personal, updatePersonal, assets, addAsset, removeAsset, settings } = useApp();
  const [first, setFirst] = useState(personal.firstName);
  const [nicks, setNicks] = useState<string[]>(personal.nicknames.length ? personal.nicknames : ['']);
  const [errors, setErrors] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [tts, setTts] = useState<TtsAvailability | null>(null);
  const [voice, setVoice] = useState<string | null>(personal.tts.voiceURI);
  const [ttsMsg, setTtsMsg] = useState<string | null>(null);
  const [clipCue, setClipCue] = useState<NonNullable<StimulusAsset['mappedCue']>>('nickname');
  const [audioMsg, setAudioMsg] = useState<string | null>(null);
  const clips = assets.filter((a) => a.kind === 'audio');

  const saveNames = async () => {
    const errs: string[] = [];
    let firstName = '';
    if (first.trim()) {
      const v = validateName(first);
      if (v.ok) firstName = v.value;
      else errs.push('שם פרטי: ' + v.errorHe);
    }
    const nicknames: string[] = [];
    nicks.forEach((n, i) => {
      if (!n.trim()) return;
      const v = validateName(n);
      if (v.ok) nicknames.push(v.value);
      else errs.push(`כינוי ${i + 1}: ${v.errorHe}`);
    });
    setErrors(errs);
    if (errs.length) return;
    await updatePersonal({ firstName, nicknames });
    setSaved(true);
  };

  const set = (patch: Partial<PersonalCueSettings>) => void updatePersonal(patch);

  return (
    <div className="stack" data-testid="personal-cue-manager">
      <p>
        אפשר לנסות פנייה בשם או בכינוי המוכר לו, כדי למשוך את תשומת ליבו. זו אפשרות, לא טיפול מוכח. השם נשמר רק במכשיר הזה, לא נשלח לשום מקום, ולא נכלל בייצוא אלא אם תבחרו בכך.
      </p>
      <label className="field">
        <span>שם פרטי (לא חובה)</span>
        <input type="text" value={first} maxLength={30} autoComplete="off" onChange={(e) => { setFirst(e.target.value); setSaved(false); }} data-testid="pc-first" />
      </label>
      {nicks.map((n, i) => (
        <div className="row" key={i}>
          <label className="field grow">
            <span>כינוי מוכר {nicks.length > 1 ? i + 1 : ''} (לא חובה)</span>
            <input type="text" value={n} maxLength={30} autoComplete="off" onChange={(e) => { setNicks(nicks.map((x, j) => (j === i ? e.target.value : x))); setSaved(false); }} data-testid={`pc-nick-${i}`} />
          </label>
          {nicks.length > 1 && <Btn variant="quiet" onClick={() => setNicks(nicks.filter((_, j) => j !== i))}>הסרה</Btn>}
        </div>
      ))}
      {nicks.length < 3 && <Btn variant="quiet" onClick={() => setNicks([...nicks, ''])}>הוספת כינוי</Btn>}
      {errors.length > 0 && (
        <Notice kind="warn" role="alert">
          {errors.map((e) => <div key={e}>{e}</div>)}
        </Notice>
      )}
      <Btn variant="primary" onClick={() => void saveNames()} data-testid="pc-save">שמירת השם והכינוי במכשיר</Btn>
      {saved && <p role="status" className="muted">נשמר במכשיר הזה בלבד.</p>}

      <fieldset className="fieldset">
        <legend>איך הוא מעדיף שפונים אליו?</legend>
        <div className="row wrap">
          {(['first_name', 'nickname', 'both', 'unset'] as PreferredAddress[]).map((p) => (
            <Choice key={p} selected={personal.preferredAddress === p} onClick={() => set({ preferredAddress: p })}>
              {{ first_name: 'בשם הפרטי', nickname: 'בכינוי', both: 'שניהם', unset: 'לא ידוע' }[p]}
            </Choice>
          ))}
        </div>
      </fieldset>

      <Toggle
        checked={personal.enabled}
        onChange={(v) => set({ enabled: v })}
        label="הפעלת רמזי פנייה אישיים"
        hint="כבוי עד שתפעילו. גם כשהוא פעיל, שום דבר לא נאמר או מושמע לבד."
        testId="pc-enable"
      />

      <fieldset className="fieldset">
        <legend>מה אומרים?</legend>
        <div className="row wrap">
          <Choice selected={personal.phrase === 'name_only'} onClick={() => set({ phrase: 'name_only' })}>רק שם או כינוי</Choice>
          <Choice selected={personal.phrase === 'name_plus_left'} onClick={() => set({ phrase: 'name_plus_left' })}>שם או כינוי + ״תסתכל שמאלה״</Choice>
        </div>
        <small>שם לבד מושך תשומת לב, אבל לא אומר לאן להסתכל. כשהמטרה היא צד שמאל, אפשר לצרף בקשה להביט שמאלה או רמז על המסך. אין הוכחה שכינוי עדיף על שם, או להפך.</small>
      </fieldset>

      <h3>דרכי הפנייה</h3>
      <Toggle checked={personal.modes.caregiverSpoken} onChange={(v) => set({ modes: { ...personal.modes, caregiverSpoken: v } })} label="המלווה אומר בקול" hint="הדרך המומלצת: קול מוכר, ואין צורך בהרשאות." testId="pc-mode-spoken" />

      <div className="card tight">
        <Toggle
          checked={personal.modes.localTts}
          disabled={!personal.tts.verifiedOffline}
          onChange={(v) => set({ modes: { ...personal.modes, localTts: v } })}
          label="השמעה אוטומטית (הקראה במכשיר)"
          hint={personal.tts.verifiedOffline ? 'אומת שקול עברי מקומי עובד בלי אינטרנט.' : 'זמין רק אחרי בדיקה שהקול העברי פועל במכשיר עצמו, בלי אינטרנט.'}
          testId="pc-mode-tts"
        />
        <Btn
          onClick={async () => {
            setTtsMsg(null);
            const a = await checkTtsAvailability();
            setTts(a);
            if (a.status === 'available' && !voice) setVoice(a.voices[0]?.voiceURI ?? null);
          }}
          data-testid="tts-check"
        >
          בדיקה אם יש קול עברי במכשיר
        </Btn>
        {tts?.status === 'unsupported' && <Notice kind="warn" role="status">הדפדפן הזה לא תומך בהקראה. אפשר לומר את השם בקול או להשתמש בקובץ קול.</Notice>}
        {tts?.status === 'no_local_hebrew_voice' && (
          <Notice kind="warn" role="status" >
            לא נמצא קול עברי שפועל במכשיר עצמו{tts.hebrewVoices > 0 ? ' (יש קול עברי, אבל ייתכן שהוא נעזר בשרת)' : ''}. כדי לשמור על פרטיות, ההקראה תישאר כבויה. אפשר לומר את השם בקול או להשתמש בקובץ קול של בן משפחה.
          </Notice>
        )}
        {tts?.status === 'available' && (
          <div className="stack">
            <div className="row wrap">
              {tts.voices.map((v, i) => (
                <Choice key={v.voiceURI} selected={voice === v.voiceURI} onClick={() => setVoice(v.voiceURI)}>קול עברי מקומי {i + 1}</Choice>
              ))}
            </div>
            <p className="small">לבדיקה: נתקו את המכשיר מהאינטרנט (מצב טיסה או כיבוי הרשת האלחוטית), ואז לחצו. יושמע משפט ניטרלי, בלי השם.</p>
            <Btn
              disabled={!voice || !settings.sound.enabled}
              onClick={async () => {
                if (!voice) return;
                const r = await runOfflineVerification(voice, settings.sound.volume);
                if (r.ok) {
                  await updatePersonal({ tts: { voiceURI: voice, verifiedOffline: true, verifiedAt: Date.now() } });
                  setTtsMsg('הבדיקה הצליחה. אם שמעתם את המשפט, אפשר להפעיל השמעה אוטומטית.');
                } else {
                  setTtsMsg(
                    r.reason === 'online'
                      ? 'המכשיר עדיין מחובר לאינטרנט. נתקו אותו ונסו שוב.'
                      : r.reason === 'not_local'
                        ? 'הקול הזה אינו מקומי. ההקראה תישאר כבויה.'
                        : 'ההשמעה לא הצליחה. ההקראה תישאר כבויה.',
                  );
                }
              }}
              data-testid="tts-verify"
            >
              בדיקה בלי אינטרנט
            </Btn>
            {!settings.sound.enabled && <small>כדי לבדוק, הפעילו קודם קול בהגדרות הקול.</small>}
          </div>
        )}
        {ttsMsg && <p role="status">{ttsMsg}</p>}
        {personal.tts.verifiedOffline && (
          <Btn variant="quiet" onClick={() => set({ tts: { voiceURI: null, verifiedOffline: false, verifiedAt: null }, modes: { ...personal.modes, localTts: false } })}>
            ביטול האימות
          </Btn>
        )}
      </div>

      <div className="card tight">
        <Toggle checked={personal.modes.importedAudio} onChange={(v) => set({ modes: { ...personal.modes, importedAudio: v } })} label="קובץ קול של בן משפחה" hint="קובץ קיים של קרוב משפחה שהסכים, שאומר את השם או הכינוי. היישום לא מקליט." testId="pc-mode-audio" />
        <div className="row wrap">
          <span>הקובץ הבא ישמש עבור:</span>
          {(Object.keys(CLIP_LABEL) as (keyof typeof CLIP_LABEL)[]).map((k) => (
            <Choice key={k} selected={clipCue === k} onClick={() => setClipCue(k)}>{CLIP_LABEL[k]}</Choice>
          ))}
        </div>
        <label className="file-btn">
          <span>בחירת קובץ קול מהמכשיר</span>
          {/* No `capture` attribute: picks an existing file, never records. */}
          <input
            type="file"
            accept="audio/*"
            data-testid="audio-file"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (!f) return;
              if (!f.type.startsWith('audio/')) return setAudioMsg('זה לא קובץ קול.');
              if (f.size > MAX_AUDIO_BYTES) return setAudioMsg('הקובץ גדול מדי (עד 5 מגה־בייט).');
              const existing = clips.find((c) => c.mappedCue === clipCue);
              if (existing) await removeAsset(existing.id);
              await addAsset({ id: newId('a-'), kind: 'audio', label: CLIP_LABEL[clipCue], mime: f.type, blob: f, createdAt: Date.now(), mappedCue: clipCue });
              setAudioMsg('הקובץ נשמר במכשיר.');
            }}
          />
        </label>
        {audioMsg && <p role="status">{audioMsg}</p>}
        <ul className="plain-list">
          {clips.map((c) => (
            <li key={c.id} className="row wrap">
              <span>{c.label}</span>
              <Btn disabled={!settings.sound.enabled} onClick={() => void playBlob(c.blob, settings.sound.volume)}>השמעה לבדיקה</Btn>
              <Btn variant="danger" onClick={() => void removeAsset(c.id)}>מחיקה</Btn>
            </li>
          ))}
        </ul>
        {clips.length > 0 && !settings.sound.enabled && <small>הקול כבוי. אפשר להפעיל בהגדרות הקול.</small>}
      </div>
    </div>
  );
}

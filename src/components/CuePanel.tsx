import { useState } from 'react';
import { isPersonalCue } from '../domain/observation';
import type { NewCue } from '../domain/runner';
import type { CueEvent, CueType, PhysicalSide, StimulusAsset } from '../domain/types';
import { playBlob, playTone } from '../services/audio';
import { speakPersonal } from '../services/tts';
import type { AppSettings, PersonalCueSettings } from '../storage/settings';
import { CUE_LABEL, SIDE_NAME } from '../i18n/he';
import { Btn, Notice } from './ui';

const OPPOSITE: Record<PhysicalSide, PhysicalSide> = { left: 'right', right: 'left', center: 'center' };

export function personalText(p: PersonalCueSettings, type: CueType): string {
  const nick = p.nicknames[0] ?? '';
  const name =
    type === 'first_name' ? p.firstName : type === 'nickname' ? nick : p.preferredAddress === 'nickname' ? nick || p.firstName : p.firstName || nick;
  if (!name) return '';
  return type === 'name_plus_left' ? `${name}, תסתכל שמאלה` : name;
}

export function hasAnyName(p: PersonalCueSettings): boolean {
  return p.firstName.trim().length > 0 || p.nicknames.some((n) => n.trim().length > 0);
}

interface Props {
  targetSide: PhysicalSide;
  cues: readonly CueEvent[];
  settings: AppSettings;
  personal: PersonalCueSettings;
  assets: StimulusAsset[];
  onCue: (c: NewCue) => void;
  onClose: () => void;
}

export function CuePanel({ targetSide, cues, settings, personal, assets, onCue, onClose }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [say, setSay] = useState<string | null>(null);
  const leftTarget = targetSide === 'left';
  const personalOn = personal.enabled;
  const vol = settings.sound.volume;
  const clips = assets.filter((a) => a.kind === 'audio' && a.mappedCue);
  const ttsReady = personalOn && personal.modes.localTts && personal.tts.verifiedOffline && !!personal.tts.voiceURI;
  const personalCount = cues.filter((c) => isPersonalCue(c.type)).length;

  const visual = (side: PhysicalSide, validity: 'valid' | 'invalid') => onCue({ type: 'visual', delivery: 'on_screen', side, validity });
  const spoken = (type: CueType, prompt: string) => {
    setSay(prompt);
    onCue({ type, delivery: 'caregiver_spoken', side: type === 'verbal_left' || type === 'name_plus_left' ? 'left' : undefined, validity: type === 'verbal_left' || type === 'name_plus_left' ? (leftTarget ? 'valid' : 'invalid') : 'not_applicable' });
  };

  const exampleName = personal.preferredAddress === 'nickname' ? personal.nicknames[0] || personal.firstName : personal.firstName || personal.nicknames[0];

  return (
    <section className="sheet" role="dialog" aria-modal="false" aria-labelledby="cue-title" data-testid="cue-panel">
      <div className="sheet-head">
        <h2 id="cue-title">רמזים</h2>
        <Btn variant="quiet" onClick={onClose} data-testid="cue-close">חזרה</Btn>
      </div>
      <p className="muted">כל לחיצה נרשמת כרמז, לפי הסדר. אם קוראים בשם פעמיים — זה נרשם כשני רמזים.</p>
      {say && (
        <Notice kind="info" role="status">
          <span data-testid="say-now">אמרו עכשיו: «{say}»</span>
        </Notice>
      )}
      {msg && <Notice kind="warn" role="status">{msg}</Notice>}

      <h3>רמזים כלליים</h3>
      <div className="row wrap">
        <Btn onClick={() => visual(targetSide, 'valid')} data-testid="cue-visual">{CUE_LABEL.visual} ב{SIDE_NAME[targetSide]}</Btn>
        {settings.allowInvalidCues && targetSide !== 'center' && (
          <Btn onClick={() => visual(OPPOSITE[targetSide], 'invalid')} data-testid="cue-visual-invalid">רמז חזותי בצד הנגדי (מתקדם)</Btn>
        )}
        {leftTarget && (
          <Btn onClick={() => spoken('verbal_left', 'תסתכל שמאלה')} data-testid="cue-verbal-left">אמרתי: ״תסתכל שמאלה״</Btn>
        )}
        <Btn
          disabled={!settings.sound.enabled}
          data-testid="cue-tone"
          onClick={async () => {
            const ok = await playTone({ volume: vol, pan: settings.sound.panEnabled && settings.sound.panVerified && targetSide !== 'center' ? (targetSide === 'left' ? -1 : 1) : 0 });
            if (ok) onCue({ type: 'neutral_tone', delivery: 'device_tone', validity: 'not_applicable' });
            else setMsg('לא ניתן היה להשמיע צליל במכשיר הזה. הרמז לא נרשם.');
          }}
        >
          {CUE_LABEL.neutral_tone}
          {!settings.sound.enabled && ' (הקול כבוי)'}
        </Btn>
        <Btn onClick={() => onCue({ type: 'other', delivery: 'caregiver_other', validity: 'not_applicable' })} data-testid="cue-other">{CUE_LABEL.other}</Btn>
      </div>

      <h3>פנייה אישית</h3>
      {!personalOn || !hasAnyName(personal) ? (
        <p className="muted">פנייה בשם או בכינוי כבויה. אפשר להפעיל אותה בהגדרות, רק אם המשפחה רוצה.</p>
      ) : (
        <>
          <p className="muted">שם לבד מושך תשומת לב, אבל לא מכוון לשמאל. שם עם בקשה להביט שמאלה הוא רמז כיווני. {personalCount >= 1 && 'כבר נעשתה פנייה אישית בניסיון הזה.'}</p>
          {personal.modes.caregiverSpoken && (
            <div className="card tight" data-testid="caregiver-name-prompt">
              <p>
                <strong>קראו לו בשם או בכינוי המוכר לו{leftTarget && personal.phrase === 'name_plus_left' ? ' ובקשו שיביט לשמאל' : ''}.</strong>
                {exampleName && <> לדוגמה: «{exampleName}»</>}
              </p>
              <div className="row wrap">
                {personal.firstName && <Btn onClick={() => spoken('first_name', personal.firstName)} data-testid="cue-said-first">אמרתי את השם</Btn>}
                {personal.nicknames[0] && <Btn onClick={() => spoken('nickname', personal.nicknames[0]!)} data-testid="cue-said-nick">אמרתי את הכינוי</Btn>}
                {leftTarget && <Btn onClick={() => spoken('name_plus_left', `${exampleName}, תסתכל שמאלה`)} data-testid="cue-said-name-left">אמרתי שם + ״תסתכל שמאלה״</Btn>}
              </div>
            </div>
          )}
          {personal.modes.localTts && (
            ttsReady ? (
              <div className="row wrap">
                {(['first_name', 'nickname', ...(leftTarget ? ['name_plus_left'] : [])] as CueType[]).filter((t) => personalText(personal, t)).map((t) => (
                  <Btn
                    key={t}
                    disabled={!settings.sound.enabled}
                    data-testid={`cue-tts-${t}`}
                    onClick={async () => {
                      const ok = await speakPersonal({ text: personalText(personal, t), voiceURI: personal.tts.voiceURI, verifiedOffline: personal.tts.verifiedOffline, optedIn: personal.modes.localTts, volume: vol });
                      if (ok) onCue({ type: t, delivery: 'local_tts', side: t === 'name_plus_left' ? 'left' : undefined, validity: t === 'name_plus_left' ? 'valid' : 'not_applicable' });
                      else setMsg('ההקראה במכשיר לא זמינה כרגע. אפשר לומר את השם בקול. הרמז לא נרשם.');
                    }}
                  >
                    הקראה במכשיר: {CUE_LABEL[t]}
                  </Btn>
                ))}
              </div>
            ) : (
              <p className="muted">הקראה במכשיר לא אומתה כפרטית במכשיר הזה, ולכן היא כבויה.</p>
            )
          )}
          {personal.modes.importedAudio && clips.length > 0 && (
            <div className="row wrap">
              {clips.map((c) => (
                <Btn
                  key={c.id}
                  disabled={!settings.sound.enabled}
                  data-testid={`cue-clip-${c.id}`}
                  onClick={async () => {
                    const ok = await playBlob(c.blob, vol);
                    const type: CueType = c.mappedCue === 'neutral' ? 'neutral_tone' : (c.mappedCue as CueType);
                    if (ok) onCue({ type, delivery: 'imported_audio', side: type === 'name_plus_left' ? 'left' : undefined, validity: type === 'name_plus_left' ? (leftTarget ? 'valid' : 'invalid') : 'not_applicable' });
                    else setMsg('לא ניתן היה להשמיע את הקובץ. הרמז לא נרשם.');
                  }}
                >
                  השמעה: {c.label}
                </Btn>
              ))}
            </div>
          )}
          {(personal.modes.localTts || personal.modes.importedAudio) && !settings.sound.enabled && <p className="muted">הקול כבוי בהגדרות.</p>}
        </>
      )}
    </section>
  );
}

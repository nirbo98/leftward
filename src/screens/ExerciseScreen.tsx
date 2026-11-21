import { useEffect, useMemo, useRef, useState } from 'react';
import { applyChange, recommendNextStep, type Recommendation, type RecommendationKind } from '../domain/adaptive';
import { alertPlanned, EXERCISES } from '../domain/exercises';
import type { NewCue } from '../domain/runner';
import { newId } from '../domain/rng';
import type { CueType, TrialParams } from '../domain/types';
import { CuePanel, hasAnyName, personalText } from '../components/CuePanel';
import { ObservationPanel } from '../components/ObservationPanel';
import { PatientStage } from '../components/PatientStage';
import { Btn, Notice } from '../components/ui';
import { playBlob, playTone, stopAll } from '../services/audio';
import { speakPersonal } from '../services/tts';
import { EXERCISE_NAME, EXERCISE_SENTENCE, ofN } from '../i18n/he';
import { useApp } from '../state/AppState';
import { navigate } from '../state/router';

export function ExerciseScreen() {
  const app = useApp();
  const { runner, session, dispatch, settings, personal, assets, photoUrls, reducedMotion } = app;
  const [panel, setPanel] = useState<'none' | 'cues' | 'help'>('none');
  const [suggestion, setSuggestion] = useState<Recommendation | null>(null);
  const [dismissed, setDismissed] = useState<RecommendationKind[]>([]);
  const [restoreParams, setRestoreParams] = useState<TrialParams | null>(null);
  const [uncuedNext, setUncuedNext] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const seenCount = useRef(runner?.completed.length ?? 0);

  // After each newly recorded observation: compute ONE conservative suggestion.
  useEffect(() => {
    if (!runner || !session) return;
    const n = runner.completed.length;
    if (n > seenCount.current) {
      if (restoreParams) {
        dispatch({ type: 'SET_PARAMS', params: restoreParams });
        setRestoreParams(null);
      }
      setUncuedNext(false);
      const r = recommendNextStep(
        { readiness: session.readiness, vision: session.vision, exercise: runner.exercise, params: restoreParams ?? runner.params, dismissed },
        runner.completed,
      );
      setSuggestion(r);
    } else if (n < seenCount.current) {
      setSuggestion(null);
    }
    seenCount.current = n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runner?.completed.length]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 6000);
    return () => clearTimeout(t);
  }, [toast]);

  const ladderNext = useMemo((): CueType | null => {
    if (!runner?.trial) return null;
    const used = new Set(runner.cues.map((c) => c.type));
    const left = runner.trial.targetSide === 'left';
    for (const t of settings.cueLadder) {
      if (used.has(t)) continue;
      if ((t === 'verbal_left' || t === 'name_plus_left') && !left) continue;
      if (t === 'name_plus_left' && !(personal.enabled && personal.phrase === 'name_plus_left' && personal.modes.caregiverSpoken && hasAnyName(personal))) continue;
      if (t === 'neutral_tone' && !settings.sound.enabled) continue;
      if (t === 'first_name' || t === 'nickname') continue; // name-only cues are never automatic ladder steps
      return t;
    }
    return null;
  }, [runner?.trial, runner?.cues, settings.cueLadder, settings.sound.enabled, personal]);

  if (!runner || !session) {
    return (
      <main className="page" id="main">
        <h1 tabIndex={-1}>אין תרגול פתוח</h1>
        <Btn variant="primary" big onClick={() => navigate('start')}>התחל תרגול</Btn>
        <Btn onClick={() => navigate('home')}>חזרה למסך הראשי</Btn>
      </main>
    );
  }

  const addCue = (c: NewCue) => dispatch({ type: 'ADD_CUE', cue: c, id: newId('c-'), now: Date.now() });

  const applyLadder = () => {
    if (!runner.trial) return;
    const t = ladderNext;
    if (!t) {
      setToast('כל שלבי העזרה כבר נוסו בניסיון הזה. אפשר לתעד, לנוח או לסיים.');
      return;
    }
    if (t === 'visual') addCue({ type: 'visual', delivery: 'on_screen', side: runner.trial.targetSide, validity: 'valid' });
    else if (t === 'verbal_left') {
      addCue({ type: 'verbal_left', delivery: 'caregiver_spoken', side: 'left', validity: 'valid' });
      setToast('אמרו עכשיו: «תסתכל שמאלה»');
    } else if (t === 'name_plus_left') {
      const name = personal.preferredAddress === 'nickname' ? personal.nicknames[0] || personal.firstName : personal.firstName || personal.nicknames[0];
      addCue({ type: 'name_plus_left', delivery: 'caregiver_spoken', side: 'left', validity: 'valid' });
      setToast(`אמרו עכשיו: «${name}, תסתכל שמאלה»`);
    } else if (t === 'neutral_tone') {
      setPanel('cues');
    } else addCue({ type: t, delivery: 'caregiver_other', validity: 'not_applicable' });
  };

  const acceptSuggestion = (r: Recommendation) => {
    setSuggestion(null);
    if (r.kind === 'stop') {
      navigate('end');
      return;
    }
    if (r.kind === 'rest') {
      stopAll();
      dispatch({ type: 'PAUSE' });
      return;
    }
    if (r.change.variable === 'oneTrialWithoutCue') {
      if (runner.params.startCue === 'visual') {
        setRestoreParams(runner.params);
        dispatch({ type: 'SET_PARAMS', params: { ...runner.params, startCue: 'none' } });
      }
      setUncuedNext(true);
      return;
    }
    const next = applyChange(runner.exercise, runner.params, r.change);
    if (next.exercise !== runner.exercise) dispatch({ type: 'SET_EXERCISE', exercise: next.exercise, params: next.params });
    else dispatch({ type: 'SET_PARAMS', params: next.params });
  };

  const phase = runner.phase;
  const trial = runner.trial;
  const done = runner.completed;
  const motionBlocked = runner.params.motion !== 'none' && reducedMotion;
  const preTarget = EXERCISES[runner.exercise].preTargetPhase;

  return (
    <div className="exercise" data-phase={phase} data-sugg={suggestion?.ruleId ?? "none"} data-n={done.length}>
      <div className="stage-wrap">
        <PatientStage trial={trial} cues={runner.cues} paused={phase === 'paused'} reducedMotion={reducedMotion} photoUrls={photoUrls} hideTarget={phase === 'pre_target' || (phase === 'paused' && runner.pausedFrom === 'pre_target')} />
        {phase === 'paused' && (
          <div className="pause-overlay" role="dialog" aria-modal="true" aria-labelledby="pause-title" data-testid="pause-overlay">
            <h2 id="pause-title">הפסקה</h2>
            <p>אפשר לנוח כמה שצריך. שום דבר לא ימשיך לבד.</p>
            <div className="row">
              <Btn variant="primary" big onClick={() => dispatch({ type: 'RESUME' })} data-testid="resume">המשך</Btn>
              <Btn big onClick={() => navigate('end')} data-testid="pause-end">סיום</Btn>
            </div>
          </div>
        )}
      </div>

      <div className="caregiver" role="region" aria-label="שליטה למלווה">
        {toast && <div className="toast" role="status" data-testid="toast">{toast}</div>}
        {uncuedNext && phase !== 'paused' && (
          <Notice role="status">בניסיון הבא: בלי רמזים ובלי פנייה בשם. רק הציגו, חכו ותעדו מה ראיתם.</Notice>
        )}
        {motionBlocked && <Notice>התנועה כבויה כי הוגדרה ״הפחתת תנועה״. המטרה תוצג בלי תנועה.</Notice>}

        {suggestion && phase === 'between' && suggestion.kind !== 'continue_same' && (
          <section className="card suggestion" aria-labelledby="sugg-title" data-testid="suggestion">
            <h2 id="sugg-title">הצעה לפי התגובות שתיעדתם</h2>
            <p data-testid="suggestion-text">{suggestion.rationaleHe}</p>
            <p className="muted">מבוסס על {ofN(suggestion.basis.comparableTrials, suggestion.basis.consideredTrials)} ניסיונות אחרונים שהיו דומים. זו הצעה, לא הוראה.</p>
            <div className="row wrap">
              <Btn variant="primary" onClick={() => acceptSuggestion(suggestion)} data-testid="suggestion-try">לנסות</Btn>
              <Btn onClick={() => setSuggestion(null)} data-testid="suggestion-continue">להמשיך כרגיל</Btn>
              <Btn variant="quiet" onClick={() => { setDismissed((d) => [...d, suggestion.kind]); setSuggestion(null); }} data-testid="suggestion-cancel">ביטול</Btn>
            </div>
          </section>
        )}
        {suggestion && phase === 'between' && suggestion.kind === 'continue_same' && (
          <p className="muted small" data-testid="suggestion-inline">{suggestion.rationaleHe}</p>
        )}

        <div className="bar">
          <div className="bar-main">
            {phase === 'between' && (
              <Btn variant="primary" big onClick={() => { setSuggestion(null); dispatch({ type: 'START_TRIAL', now: Date.now() }); }} data-testid="show-target">
                {preTarget ? 'ניסיון חדש (מסך ריק)' : done.length === 0 ? 'הצג מטרה' : 'ניסיון הבא'}
              </Btn>
            )}
            {phase === 'pre_target' && trial && (
              <AlertControls
                planned={alertPlanned(trial.index)}
                alertsGiven={runner.cues.length}
                onCue={addCue}
                onReveal={() => dispatch({ type: 'REVEAL_TARGET', now: Date.now() })}
                setToast={setToast}
              />
            )}
            {(phase === 'stimulus' || phase === 'observing') && (
              <>
                <Btn variant="primary" big onClick={() => { setPanel('none'); dispatch({ type: 'OPEN_OBSERVATION' }); }} data-testid="record">
                  תיעוד מה ראיתי
                </Btn>
                <Btn big onClick={applyLadder} data-testid="more-help" disabled={uncuedNext}>עזרה נוספת</Btn>
                <Btn onClick={() => setPanel(panel === 'cues' ? 'none' : 'cues')} data-testid="open-cues" disabled={uncuedNext}>רמזים</Btn>
                <Btn onClick={() => dispatch({ type: 'REPEAT_TRIAL', now: Date.now() })} data-testid="repeat" aria-label="חזרה על הניסיון מההתחלה, בלי הרמזים שניתנו">חזרה</Btn>
              </>
            )}
          </div>
          <div className="bar-side">
            <Btn onClick={() => dispatch({ type: 'UNDO' })} disabled={runner.undo.length === 0 || phase === 'paused'} data-testid="undo" aria-label="ביטול הפעולה האחרונה">ביטול פעולה</Btn>
            <Btn onClick={() => { stopAll(); dispatch({ type: 'PAUSE' }); }} disabled={phase === 'paused'} data-testid="pause">הפסקה</Btn>
            <Btn onClick={() => setPanel(panel === 'help' ? 'none' : 'help')} data-testid="help">עזרה</Btn>
            <Btn variant="danger" onClick={() => { stopAll(); navigate('end'); }} data-testid="end">סיום</Btn>
          </div>
        </div>
        <p className="muted small status-line" aria-live="polite">
          {EXERCISE_NAME[runner.exercise]} · ניסיונות שתועדו: {done.length}
        </p>
      </div>

      {phase === 'observing' && trial && (
        <ObservationPanel
          key={`${trial.index}-${runner.cues.length}`}
          trial={trial}
          cues={runner.cues}
          onClose={() => dispatch({ type: 'CLOSE_OBSERVATION' })}
          onSave={(o) => dispatch({ type: 'RECORD', observation: o, id: newId('t-') })}
        />
      )}
      {panel === 'cues' && trial && phase === 'stimulus' && (
        <CuePanel targetSide={trial.targetSide} cues={runner.cues} settings={settings} personal={personal} assets={assets} onCue={addCue} onClose={() => setPanel('none')} />
      )}
      {panel === 'help' && (
        <section className="sheet" role="dialog" aria-labelledby="help-title" data-testid="help-panel">
          <div className="sheet-head">
            <h2 id="help-title">איך מתרגלים</h2>
            <Btn variant="quiet" onClick={() => setPanel('none')}>סגירה</Btn>
          </div>
          <p><strong>{EXERCISE_NAME[runner.exercise]}:</strong> {EXERCISE_SENTENCE[runner.exercise]}</p>
          <ol>
            <li>לחצו ״הצג מטרה״. חכו כמה שניות בשקט.</li>
            <li>אם הוא לא מסתכל לבד — אפשר ״עזרה נוספת״: קודם רמז על המסך, אחר כך בקשה בקול.</li>
            <li>לחצו ״תיעוד מה ראיתי״ ובחרו מה באמת קרה: עיניים, ראש, שניהם, לא ברור, או שלא ראיתם תגובה.</li>
            <li>אם הוא עייף או לא נוח לו — ״הפסקה״ או ״סיום״. אין צורך להשלים מספר ניסיונות.</li>
          </ol>
          <p className="muted">היישום לא רואה את העיניים שלו. רק אתם רואים. ״לא ראיתי תגובה״ לא אומר שהוא לא רואה.</p>
          {runner.exercise === 'saccadic_exploration' && <p className="muted">במטרה שעוברת מקום: כל ״ניסיון הבא״ מעביר את המטרה למקום חדש.</p>}
          {runner.exercise === 'leftward_pursuit' && <p className="muted">החפצים נעים לאט שמאלה. אחרי כחצי דקה של מעקב, תעדו אם נראה שעקב אחריהם בעיניים או בראש. ״הפסקה״ עוצרת את התנועה מיד.</p>}
          {runner.exercise === 'alert_then_target' && <p className="muted">המסך ריק. אם מוצע ״עם התראה״ — קראו לו בשם או אמרו ״שים לב״, לחצו על הכפתור המתאים, ומיד ״הצג מטרה עכשיו״. אם מוצע ״בלי התראה״ — פשוט הציגו. ההשוואה בין שני סוגי הניסיונות היא רק תיאור, לא מבחן.</p>}
        </section>
      )}
    </div>
  );
}

/** Pre-target alert controls (phasic-alerting-inspired exercise). Non-spatial alerts only. */
function AlertControls({ planned, alertsGiven, onCue, onReveal, setToast }: {
  planned: boolean;
  alertsGiven: number;
  onCue: (c: NewCue) => void;
  onReveal: () => void;
  setToast: (t: string) => void;
}) {
  const { personal, settings, assets } = useApp();
  const named = personal.enabled && personal.modes.caregiverSpoken && hasAnyName(personal);
  const nameType: CueType = personal.preferredAddress === 'nickname' && personal.nicknames[0] ? 'nickname' : personal.firstName ? 'first_name' : 'nickname';
  const ttsReady = personal.enabled && personal.modes.localTts && personal.tts.verifiedOffline && settings.sound.enabled;
  const clip = personal.enabled && personal.modes.importedAudio && settings.sound.enabled
    ? assets.find((a) => a.kind === 'audio' && (a.mappedCue === 'first_name' || a.mappedCue === 'nickname'))
    : undefined;
  return (
    <>
      <span className="planned" data-testid="alert-planned">{planned ? 'מוצע בניסיון הזה: עם התראה' : 'מוצע בניסיון הזה: בלי התראה'}</span>
      {named && (
        <Btn onClick={() => onCue({ type: nameType, delivery: 'caregiver_spoken', validity: 'not_applicable' })} data-testid="alert-name">אמרתי את שמו</Btn>
      )}
      <Btn onClick={() => onCue({ type: 'verbal_alert', delivery: 'caregiver_spoken', validity: 'not_applicable' })} data-testid="alert-verbal">אמרתי ״שים לב״</Btn>
      {settings.sound.enabled && (
        <Btn
          data-testid="alert-tone"
          onClick={async () => {
            if (await playTone({ volume: settings.sound.volume })) onCue({ type: 'neutral_tone', delivery: 'device_tone', validity: 'not_applicable' });
            else setToast('לא ניתן היה להשמיע צליל. ההתראה לא נרשמה.');
          }}
        >
          צליל קצר
        </Btn>
      )}
      {ttsReady && personalText(personal, nameType) && (
        <Btn
          data-testid="alert-tts"
          onClick={async () => {
            const ok = await speakPersonal({ text: personalText(personal, nameType), voiceURI: personal.tts.voiceURI, verifiedOffline: personal.tts.verifiedOffline, optedIn: true, volume: settings.sound.volume });
            if (ok) onCue({ type: nameType, delivery: 'local_tts', validity: 'not_applicable' });
            else setToast('ההקראה לא זמינה. אפשר לומר את השם בקול.');
          }}
        >
          הקראת השם
        </Btn>
      )}
      {clip && (
        <Btn
          data-testid="alert-clip"
          onClick={async () => {
            if (await playBlob(clip.blob, settings.sound.volume)) onCue({ type: clip.mappedCue === 'nickname' ? 'nickname' : 'first_name', delivery: 'imported_audio', validity: 'not_applicable' });
            else setToast('לא ניתן היה להשמיע את הקובץ.');
          }}
        >
          השמעת קובץ
        </Btn>
      )}
      <Btn variant="primary" big onClick={onReveal} data-testid="reveal-target">
        {alertsGiven > 0 ? 'הצג מטרה עכשיו' : 'הצג מטרה (בלי התראה)'}
      </Btn>
    </>
  );
}

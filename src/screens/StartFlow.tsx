import { useMemo, useState } from 'react';
import { recommendStart, type StartSuggestion } from '../domain/adaptive';
import { EXERCISES, EXERCISE_ORDER, MAX_DISTRACTORS } from '../domain/exercises';
import type { ExerciseId, GlassesContext, PhysicalSide, Readiness, StimulusSize, StimulusTheme, TrialParams, VisionContext, VisionPreviewResponse } from '../domain/types';
import { SIZE_ORDER } from '../domain/types';
import { Glyph } from '../components/Glyph';
import { PALETTE } from '../components/PatientStage';
import { Btn, Choice, Notice, Page, Toggle } from '../components/ui';
import { ACUTE_CHANGE_NOTE, EXERCISE_NAME, EXERCISE_SENTENCE, READINESS_LABEL, SIDE_NAME, SIZE_LABEL, THEME_LABEL, VISION_LABEL } from '../i18n/he';
import { detectDeviceClass, useApp } from '../state/AppState';
import { navigate } from '../state/router';

type Step = 'readiness' | 'rest' | 'vision' | 'vision_followup' | 'suggest' | 'choose' | 'advanced';

export function StartFlow() {
  const app = useApp();
  const { settings, sessions, trials, assets } = app;
  const [step, setStep] = useState<Step>('readiness');
  const [readiness, setReadiness] = useState<Readiness | null>(null);
  const [glasses, setGlasses] = useState<GlassesContext>('not_recorded');
  const [preview, setPreview] = useState<VisionPreviewResponse>('skipped');
  const [forceSimple, setForceSimple] = useState(false);

  const photoIds = useMemo(
    () => settings.selectedPhotoIds.filter((id) => assets.some((a) => a.id === id && a.kind === 'image')),
    [settings.selectedPhotoIds, assets],
  );
  const vision: VisionContext = { preview, glasses };

  const suggestion: StartSuggestion | null = useMemo(() => {
    if (!readiness) return null;
    const s = recommendStart({
      readiness,
      vision,
      deviceClass: detectDeviceClass(),
      preferredTheme: forceSimple ? 'shapes' : settings.preferredTheme,
      photoIds,
      history: { sessions, trials },
    });
    // The caregiver's preferred size applies only on an alert day with no visibility doubt.
    const sizeOk = s.ruleId === 'S3-alert-default' || s.ruleId === 'S4-history-scanning';
    return { ...s, params: { ...s.params, contrast: settings.contrast, size: sizeOk ? settings.defaultSize : s.params.size } };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readiness, preview, glasses, forceSimple, settings.preferredTheme, settings.contrast, settings.defaultSize, photoIds, sessions, trials]);

  const start = async (exercise: ExerciseId, params: TrialParams, extra?: { description?: string; clinicianReviewNotes?: string }) => {
    if (!readiness || readiness === 'not_fit') return;
    await app.beginSession({ readiness, vision, exercise, params, description: extra?.description });
    if (extra?.clinicianReviewNotes) await app.updateSession({ clinicianReviewNotes: extra.clinicianReviewNotes });
    navigate('exercise');
  };

  if (step === 'readiness') {
    return (
      <Page title="איך הוא מרגיש עכשיו?" onBack={() => navigate('home')}>
        <div className="stack" role="group" aria-label="מצב נוכחי">
          {(['alert', 'tired', 'not_fit'] as Readiness[]).map((r) => (
            <Btn
              key={r}
              big
              variant={r === 'not_fit' ? 'quiet' : 'secondary'}
              data-testid={`readiness-${r}`}
              onClick={async () => {
                setReadiness(r);
                if (r === 'not_fit') {
                  await app.recordRestOnly({ readiness: r, vision: { preview: 'skipped', glasses: 'not_recorded' } });
                  setStep('rest');
                } else setStep('vision');
              }}
            >
              {READINESS_LABEL[r]}
            </Btn>
          ))}
        </div>
        <Notice kind="safety">{ACUTE_CHANGE_NOTE} הבחירה כאן היא רק כדי להתאים את התרגול, ואינה אומרת שהמצב הרפואי יציב.</Notice>
      </Page>
    );
  }

  if (step === 'rest') {
    return (
      <Page title="מנוחה">
        <p className="lead">היום לא מתרגלים. מנוחה היא הבחירה הנכונה. אפשר לנסות בפעם אחרת.</p>
        <Notice kind="safety">{ACUTE_CHANGE_NOTE}</Notice>
        <Btn variant="primary" big onClick={() => navigate('home')} data-testid="rest-exit">
          חזרה למסך הראשי
        </Btn>
      </Page>
    );
  }

  if (step === 'vision') {
    const pal = PALETTE[settings.contrast];
    return (
      <Page title="בדיקה קצרה: האם רואים?" onBack={() => setStep('readiness')} backLabel="חזרה">
        <p>הצורה הגדולה מוצגת לו. האם נראה שהוא מבחין בה? זו לא בדיקת ראייה, ולא בודקים כאן הזנחה.</p>
        <div className="preview-stage" dir="ltr" style={{ background: pal.bg }} data-testid="vision-preview">
          <div className="preview-obj">
            <Glyph glyph="disc" fg={pal.fg} bg={pal.bg} label="" />
          </div>
        </div>
        <div className="row wrap" role="group" aria-label="תגובה לבדיקת הנראות">
          {(['noticed', 'unclear', 'not_noticed', 'skipped'] as VisionPreviewResponse[]).map((v) => (
            <Btn
              key={v}
              big={v === 'noticed'}
              variant={v === 'skipped' ? 'quiet' : 'secondary'}
              data-testid={`vision-${v}`}
              onClick={() => {
                setPreview(v);
                setStep(v === 'unclear' || v === 'not_noticed' ? 'vision_followup' : 'suggest');
              }}
            >
              {v === 'skipped' ? 'דלג' : VISION_LABEL[v]}
            </Btn>
          ))}
        </div>
        <fieldset className="fieldset">
          <legend>משקפיים (לא חובה)</legend>
          <div className="row wrap">
            <Choice selected={glasses === 'wearing'} onClick={() => setGlasses('wearing')}>מרכיב משקפיים</Choice>
            <Choice selected={glasses === 'not_available'} onClick={() => setGlasses('not_available')}>משקפיים לא זמינים</Choice>
            <Choice selected={glasses === 'not_recorded'} onClick={() => setGlasses('not_recorded')}>לא רלוונטי / לא יודע</Choice>
          </div>
        </fieldset>
      </Page>
    );
  }

  if (step === 'vision_followup') {
    return (
      <Page title="לא ברור אם הוא רואה" onBack={() => setStep('vision')} backLabel="חזרה">
        <p>זה קורה. ייתכן שזו עייפות, טשטוש, תאורה, מרחק, או סיבה אחרת. אי אפשר לדעת מכאן, וזה לא אומר שיש הזנחה.</p>
        <div className="stack">
          <Btn big variant="primary" data-testid="vision-continue-simple" onClick={() => { setForceSimple(true); setStep('suggest'); }}>
            להמשיך עם צורה גדולה וברורה
          </Btn>
          <Btn big variant="quiet" data-testid="vision-stop" onClick={() => navigate('home')}>
            לעצור להיום
          </Btn>
        </div>
        <Notice>כדאי לבדוק תאורה, מרחק מהמסך ומשקפיים. בדיקת ראייה ותיקון משקפיים הם עניין לצוות המטפל.</Notice>
      </Page>
    );
  }

  if (step === 'choose') {
    return (
      <Page title="בחרו תרגול אחר" onBack={() => setStep('suggest')} backLabel="חזרה">
        <div className="stack">
          {EXERCISE_ORDER.map((id) => {
            const base = { ...EXERCISES[id].defaults, contrast: settings.contrast };
            const tired = readiness === 'tired';
            return (
              <button
                type="button"
                key={id}
                className="card card-button"
                data-testid={`choose-${id}`}
                onClick={() => void start(id, tired ? { ...base, distractors: 0, size: 'huge' } : { ...base, theme: suggestion?.params.theme ?? 'shapes', photoIds })}
              >
                <strong>{EXERCISE_NAME[id]}</strong>
                <span>{EXERCISE_SENTENCE[id]}</span>
              </button>
            );
          })}
        </div>
        {readiness === 'tired' && <Notice>כשהוא עייף, עדיף חפץ אחד גדול ועומד. כל תרגול שתבחרו יתחיל בגרסה הפשוטה ביותר.</Notice>}
      </Page>
    );
  }

  if (step === 'advanced' && suggestion) {
    return <AdvancedSetup initial={suggestion} onBack={() => setStep('suggest')} onStart={start} photoIds={photoIds} />;
  }

  // suggest
  return (
    <Page title="מוכנים" onBack={() => setStep('vision')} backLabel="חזרה">
      {suggestion && (
        <section className="card" aria-live="polite">
          <p className="lead" data-testid="start-sentence">{suggestion.sentenceHe}</p>
          {suggestion.provisionalFromHistory && <p className="muted">זו הצעה זמנית לפי מפגש קודם. מה שקובע הוא איך הוא היום.</p>}
          <Btn variant="primary" big data-testid="start-adapted" onClick={() => void start(suggestion.exercise, suggestion.params)}>
            התחל תרגול מותאם
          </Btn>
        </section>
      )}
      <div className="row wrap">
        <Btn onClick={() => setStep('choose')} data-testid="start-choose-other">בחרו תרגול אחר</Btn>
        {settings.advancedMode && (
          <Btn onClick={() => setStep('advanced')} data-testid="start-advanced">אפשרויות מתקדמות</Btn>
        )}
      </div>
    </Page>
  );
}

function AdvancedSetup({ initial, onBack, onStart, photoIds }: {
  initial: StartSuggestion;
  onBack: () => void;
  onStart: (e: ExerciseId, p: TrialParams, extra?: { description?: string; clinicianReviewNotes?: string }) => Promise<void>;
  photoIds: string[];
}) {
  const { settings, reducedMotion } = useApp();
  const [exercise, setExercise] = useState<ExerciseId>(initial.exercise);
  const [p, setP] = useState<TrialParams>({ ...initial.params, photoIds });
  const [description, setDescription] = useState('');
  const [clinician, setClinician] = useState('');
  const def = EXERCISES[exercise];
  const set = (patch: Partial<TrialParams>) => setP((x) => ({ ...x, ...patch }));
  const pursuitAllowed = def.supportsMotion && settings.pursuitApprovedByClinician && !reducedMotion;

  return (
    <Page title="אפשרויות מתקדמות" onBack={onBack} backLabel="חזרה">
      <Notice>הגדרה ידנית לשימוש עם הנחיית צוות השיקום. כללי הפרטיות והעצירה נשארים בתוקף תמיד.</Notice>
      <fieldset className="fieldset">
        <legend>תרגול</legend>
        <div className="row wrap">
          {EXERCISE_ORDER.map((id) => (
            <Choice key={id} selected={exercise === id} data-testid={`adv-ex-${id}`} onClick={() => { setExercise(id); setP({ ...EXERCISES[id].defaults, theme: p.theme, contrast: p.contrast, photoIds }); }}>
              {EXERCISE_NAME[id]}
            </Choice>
          ))}
        </div>
        <small>{EXERCISE_SENTENCE[exercise]}</small>
      </fieldset>
      <fieldset className="fieldset">
        <legend>סוג המטרות</legend>
        <div className="row wrap">
          {(['shapes', 'cars', 'watches', 'photos'] as StimulusTheme[]).map((t) => (
            <Choice key={t} selected={p.theme === t} disabled={t === 'photos' && photoIds.length === 0} onClick={() => set({ theme: t })}>
              {THEME_LABEL[t]}
            </Choice>
          ))}
        </div>
        {photoIds.length === 0 && <small>כדי להשתמש בתמונות, בחרו תמונות בהגדרות.</small>}
      </fieldset>
      <fieldset className="fieldset">
        <legend>גודל וניגודיות</legend>
        <div className="row wrap">
          {SIZE_ORDER.map((s: StimulusSize) => (
            <Choice key={s} selected={p.size === s} onClick={() => set({ size: s, distractors: Math.min(p.distractors, MAX_DISTRACTORS[s]) })}>{SIZE_LABEL[s]}</Choice>
          ))}
          <Choice selected={p.contrast === 'high_dark'} onClick={() => set({ contrast: 'high_dark' })}>רקע כהה</Choice>
          <Choice selected={p.contrast === 'high_light'} onClick={() => set({ contrast: 'high_light' })}>רקע בהיר</Choice>
        </div>
      </fieldset>
      <fieldset className="fieldset">
        <legend>מיקום</legend>
        <div className="row wrap">
          {(['left', 'center', 'right'] as PhysicalSide[]).map((s) => (
            <Choice key={s} selected={p.targetSide === s} disabled={exercise === 'saccadic_exploration'} onClick={() => set({ targetSide: s })}>
              מטרה ב{SIDE_NAME[s]}
            </Choice>
          ))}
        </div>
        <Toggle checked={p.showLeftAnchor} onChange={(v) => set({ showLeftAnchor: v })} label="פס עוגן בקצה השמאלי" />
        {def.supportsDistractors && (
          <label className="field">
            <span>מספר חפצים נוספים (עד {MAX_DISTRACTORS[p.size]})</span>
            <input type="number" min={0} max={MAX_DISTRACTORS[p.size]} value={p.distractors} onChange={(e) => set({ distractors: Math.max(0, Math.min(MAX_DISTRACTORS[p.size], Number(e.target.value) || 0)) })} />
          </label>
        )}
      </fieldset>
      <fieldset className="fieldset">
        <legend>רמזים</legend>
        <Toggle checked={p.startCue === 'visual'} onChange={(v) => set({ startCue: v ? 'visual' : 'none' })} label="רמז חזותי כבר בתחילת כל ניסיון" hint="ניסיונות כאלה לעולם לא ייחשבו כתגובה בלי רמז." />
        <Toggle checked={p.cueSalience === 'soft'} onChange={(v) => set({ cueSalience: v ? 'soft' : 'strong' })} label="רמז חזותי עדין יותר" />
      </fieldset>
      {def.supportsMotion && (
        <fieldset className="fieldset">
          <legend>תנועה איטית</legend>
          <Toggle
            checked={p.motion === 'slow_pursuit'}
            disabled={!pursuitAllowed}
            onChange={(v) => set({ motion: v ? 'slow_pursuit' : 'none' })}
            label="מטרה שנעה לאט מימין לשמאל"
            hint={pursuitAllowed ? 'אפשר לעצור בכל רגע. התנועה מתחילה רק אחרי לחיצה.' : reducedMotion ? 'כבוי כי הוגדר "הפחתת תנועה".' : 'יש לאשר בהגדרות שצוות השיקום אישר תנועה איטית.'}
          />
        </fieldset>
      )}
      <label className="field">
        <span>תיאור המפגש (לא חובה)</span>
        <input type="text" value={description} maxLength={200} onChange={(e) => setDescription(e.target.value)} />
      </label>
      <label className="field">
        <span>הערות לצוות המטפל (לא חובה)</span>
        <textarea value={clinician} maxLength={1000} onChange={(e) => setClinician(e.target.value)} />
      </label>
      <Btn variant="primary" big data-testid="adv-start" onClick={() => void onStart(exercise, p, { description: description || undefined, clinicianReviewNotes: clinician || undefined })}>
        התחל
      </Btn>
    </Page>
  );
}

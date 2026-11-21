import { useState } from 'react';
import type { CueEvent, IdentificationJudgment, Observation, ObservationFlags, ObservationOutcome, PhysicalSide, TrialSpec } from '../domain/types';
import { NO_FLAGS } from '../domain/types';
import { CUE_DELIVERY_LABEL, CUE_LABEL, SIDE_WORD } from '../i18n/he';
import { Btn, Choice, Toggle } from './ui';

type OutcomeKey = 'eyes' | 'head' | 'eyes_and_head' | 'unclear_kind' | 'none' | 'other_direction' | 'cannot';

function toOutcome(k: OutcomeKey): ObservationOutcome {
  switch (k) {
    case 'eyes':
    case 'head':
    case 'eyes_and_head':
    case 'unclear_kind':
      return { kind: 'oriented', modality: k };
    case 'none':
      return { kind: 'no_response_observed' };
    case 'other_direction':
      return { kind: 'other_direction' };
    case 'cannot':
      return { kind: 'cannot_determine', reason: 'fatigue' };
  }
}

export function cueSummary(cues: readonly CueEvent[]): string {
  if (cues.length === 0) return 'לא ניתן רמז בניסיון הזה.';
  return 'רמזים שניתנו: ' + cues.map((c) => `${c.order}. ${CUE_LABEL[c.type]} (${CUE_DELIVERY_LABEL[c.delivery]}${c.validity === 'invalid' ? ', בצד הנגדי' : ''}${c.preTarget ? ', לפני המטרה' : ''})`).join(' · ');
}

export function ObservationPanel({ trial, cues, onSave, onClose }: {
  trial: TrialSpec;
  cues: readonly CueEvent[];
  onSave: (o: Observation) => void;
  onClose: () => void;
}) {
  const side: PhysicalSide = trial.targetSide;
  const w = SIDE_WORD[side];
  const [choice, setChoice] = useState<OutcomeKey | null>(null);
  const [beforeFirstCue, setBeforeFirstCue] = useState(false);
  const [ident, setIdent] = useState<IdentificationJudgment>('not_recorded');
  const [flags, setFlags] = useState<ObservationFlags>(NO_FLAGS);
  const [marked, setMarked] = useState<string[]>([]);
  const [note, setNote] = useState('');
  const isSearch = trial.exercise === 'target_search' || trial.exercise === 'visual_scanning';
  const oriented = choice === 'eyes' || choice === 'head' || choice === 'eyes_and_head';

  const options: { k: OutcomeKey; label: string }[] = [
    { k: 'eyes', label: `עיניים ${w}` },
    { k: 'head', label: `ראש ${w}` },
    { k: 'eyes_and_head', label: `עיניים וראש ${w}` },
    { k: 'unclear_kind', label: 'תגובה לא ברורה' },
    { k: 'none', label: 'לא ראיתי תגובה' },
    { k: 'other_direction', label: 'הסתכל לכיוון אחר' },
    { k: 'cannot', label: 'עייף / לא ניתן לדעת' },
  ];

  return (
    <section className="sheet" role="dialog" aria-modal="false" aria-labelledby="obs-title" data-testid="observation-panel">
      <div className="sheet-head">
        <h2 id="obs-title">מה ראיתם?</h2>
        <Btn variant="quiet" onClick={onClose} data-testid="obs-close">חזרה</Btn>
      </div>
      <p className="muted" data-testid="cue-summary">{cueSummary(cues)}</p>
      <div className="obs-grid" role="group" aria-label="מה נצפה">
        {options.map((o) => (
          <Choice key={o.k} selected={choice === o.k} onClick={() => setChoice(o.k)} data-testid={`obs-${o.k}`}>
            {o.label}
          </Choice>
        ))}
      </div>

      {cues.some((c) => !c.preTarget) && oriented && (
        <Toggle
          checked={beforeFirstCue}
          onChange={setBeforeFirstCue}
          label="ההפניה קרתה עוד לפני הרמז הראשון"
          hint="סמנו רק אם אתם בטוחים. אחרת היא תירשם כ״אחרי רמז״."
          testId="obs-before-first-cue"
        />
      )}

      <details className="obs-more">
        <summary>פרטים נוספים (לא חובה)</summary>
        <div className="row wrap" role="group" aria-label="האם נראה שזיהה">
          <span>נראה שזיהה את המטרה?</span>
          <Choice selected={ident === 'seemed_to_identify'} onClick={() => setIdent(ident === 'seemed_to_identify' ? 'not_recorded' : 'seemed_to_identify')} data-testid="obs-ident-yes">כן</Choice>
          <Choice selected={ident === 'not_sure'} onClick={() => setIdent(ident === 'not_sure' ? 'not_recorded' : 'not_sure')}>לא בטוח</Choice>
        </div>
        <div className="row wrap">
          <Toggle checked={flags.fatigue} onChange={(v) => setFlags({ ...flags, fatigue: v })} label="נראה עייף" testId="flag-fatigue" />
          <Toggle checked={flags.discomfort} onChange={(v) => setFlags({ ...flags, discomfort: v })} label="אי־נוחות" testId="flag-discomfort" />
          <Toggle checked={flags.poorVisibility} onChange={(v) => setFlags({ ...flags, poorVisibility: v })} label="אולי קשה לראות" testId="flag-visibility" />
          <Toggle checked={flags.lostEngagement} onChange={(v) => setFlags({ ...flags, lostEngagement: v })} label="הקשב ירד" testId="flag-engagement" />
        </div>
        {isSearch && (
          <div>
            <p className="muted">אפשר לסמן חפצים שנראה שהסתכל עליהם (זה סימון שלכם, לא מדידת מבט):</p>
            <div className="mini-map" dir="ltr" data-testid="mini-map">
              {trial.items.map((it) => (
                <button
                  key={it.id}
                  type="button"
                  className={'mini-item' + (marked.includes(it.id) ? ' on' : '')}
                  style={{ left: `${it.xPct}%`, top: `${it.yPct}%` }}
                  aria-pressed={marked.includes(it.id)}
                  aria-label={`חפץ ${it.role === 'target' ? 'מטרה' : ''} במיקום ${Math.round(it.xPct)} אחוז משמאל`}
                  onClick={() => setMarked((m) => (m.includes(it.id) ? m.filter((x) => x !== it.id) : [...m, it.id]))}
                >
                  {it.role === 'target' ? '★' : '●'}
                </button>
              ))}
            </div>
          </div>
        )}
        <label className="field">
          <span>הערה קצרה</span>
          <input type="text" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </details>

      <Btn
        variant="primary"
        big
        disabled={!choice}
        data-testid="obs-save"
        onClick={() =>
          choice &&
          onSave({
            outcome: toOutcome(choice),
            caregiverSaysBeforeFirstCue: cues.some((c) => !c.preTarget) && oriented && beforeFirstCue,
            identification: ident,
            flags,
            caregiverMarkedObjectIds: marked,
            note: note.trim() || undefined,
            recordedAt: Date.now(),
          })
        }
      >
        שמירה
      </Btn>
    </section>
  );
}

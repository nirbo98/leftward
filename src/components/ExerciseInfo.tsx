import type { ExerciseId } from '../domain/types';
import { EXERCISE_INFO } from '../i18n/exerciseInfo';

const PARTS = [
  ['why', 'למה'],
  ['when', 'מתי מתאים'],
  ['how', 'איך עושים'],
  ['whenNot', 'מתי לא'],
] as const;

/** Plain-language "about this exercise" for families: why, when, how, when not. */
export function ExerciseInfo({ id }: { id: ExerciseId }) {
  const info = EXERCISE_INFO[id];
  return (
    <dl className="exercise-info" data-testid={`exercise-info-${id}`}>
      {PARTS.map(([k, label]) => (
        <div key={k} className="exercise-info-row">
          <dt>{label}</dt>
          <dd>{info[k]}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Collapsible variant used in lists. */
export function ExerciseInfoToggle({ id }: { id: ExerciseId }) {
  return (
    <details className="info-toggle" data-testid={`info-toggle-${id}`}>
      <summary>על התרגול</summary>
      <ExerciseInfo id={id} />
    </details>
  );
}

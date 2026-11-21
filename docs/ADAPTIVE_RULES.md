# Adaptive rules (`src/domain/adaptive.ts`)

`recommendNextStep(context, recentObservations): Recommendation` is a **pure, deterministic** function. It uses only caregiver-entered observations and caregiver-entered context (readiness, vision preview, glasses, current exercise/parameters, dismissed suggestions). It never senses gaze, never uses reaction times, d′, cut-offs, norms or ML/LLM inference, and never acts on its own: the UI shows the suggestion as **הצעה לפי התגובות שתיעדתם** with **לנסות / להמשיך כרגיל / ביטול**. All thresholds are **product heuristics**, not validated treatment thresholds.

## Inputs and derived classes

Each trial record carries the ordered cue list and the caregiver observation. `classifyObservation()` derives:

| Class | Definition |
|---|---|
| `spontaneous` | Oriented toward the target, **no cue preceded it** (no cues, or caregiver explicitly ticked "before the first cue") |
| `after_spatial_cue` | Oriented after ≥1 cue, at least one spatial (visual, "look left", name + "look left") or unknown ("other") |
| `after_nonspatial_cue` | Oriented after only non-spatial cues (name alone, nickname alone, neutral tone) — alerting, **not** evidence of spatial cueing |
| `other_direction` | Looked elsewhere |
| `no_response_observed` | Caregiver saw no response — **not** interpreted as visual-field loss or neglect |
| `cannot_determine` | Unclear, fatigue, visibility, unclear modality, or a fatigue/visibility flag on an otherwise positive observation |

A visual cue configured to appear at trial start is logged as cue #1, so such trials are never "spontaneous".

## Comparability guard

Only the **contiguous run of most recent trials with the same comparability key** is pooled (max 3):
`exercise | theme | size | distractors (capped) | targetSide | startCue | cueSalience | motion`.
Changing any of these starts a new run. Across sessions, history is used only for the *starting* suggestion, only from the **same device class**, only from an **alert** day, and is labelled provisional.

## Rule order (first match wins)

| Id | Condition | Suggestion | Raises demand? |
|---|---|---|---|
| R0 | readiness `not_fit` | stop | no |
| R1 | last trial flagged discomfort | stop | no |
| R2 | last trial fatigue (flag or outcome) | rest | no |
| R3 | last trial lost engagement | rest | no |
| R4 | last trial poor visibility | photo/car/watch → simple shape; else enlarge one step; else rest | no |
| R5 | ≥2 of last 3 trials `cannot_determine` | as R4 (simplify), else rest | no |
| R6 | last 2 comparable = `no_response_observed` | strengthen ONE support: soft→strong cue; else enlarge; else start-of-trial visual cue; else rest | no |
| R7 | last 3 trials all contained a personal cue, and escalation allowed | one trial without any cue (habituation guard) | yes |
| R8 | last 3 comparable all `spontaneous` toward a **physically-left** target, escalation allowed | exactly one less-assisted step: remove start cue → (guided) try sparse scanning → (scanning/search) +1 distractor up to size cap → (scanning) try target search | yes |
| R8-hold | as R8 but escalation not allowed or nothing left | continue unchanged | no |
| R9 | last 3 comparable cue-dependent with start cue on, escalation allowed | one trial without the start cue | yes |
| R10 | last 2 comparable cue-dependent | maintain current cue | no |
| R11 | otherwise | continue unchanged (inline note, no card) | no |

**Escalation allowed** only if: readiness `alert` **and** vision preview not `unclear`/`not_noticed` **and** no fatigue/visibility/engagement flag in the comparable run. A tired day therefore never increases difficulty, even after a good previous day. Dismissed (ביטול) suggestion kinds are not offered again in the same session.

`applyChange()` changes exactly one variable (or switches exercise while keeping the caregiver's visual choices). "One trial without cue" temporarily removes the start cue for the next trial only and tells the caregiver to give no cues; parameters are restored after it is recorded.

## Start-of-session suggestion (`recommendStart`)

| Id | Condition | Start |
|---|---|---|
| S0 | not fit | no training |
| S1 | tired | guided orienting, huge simple shape (overrides any history) |
| S2 | alert, vision unclear/not noticed or glasses unavailable | guided orienting, huge simple shape |
| S4 | alert, previous alert session on same device class had ≥3 spontaneous left orientations in guided orienting and they were ≥ half of interpretable trials | sparse scanning (2 objects), labelled provisional |
| S3 | otherwise | guided orienting with preferred theme |

## Cue ladder ("עזרה נוספת")

Default order: on-screen visual cue at the target → caregiver says "תסתכל שמאלה" → caregiver says name/nickname + "תסתכל שמאלה" (only if personal cues are enabled). Name-only cues are never automatic ladder steps. Order is editable in advanced settings. Each step is logged in order with its delivery mode.

## Tests

`src/domain/adaptive.test.ts` covers: one-variable changes, no escalation on tired/uncertain/low-visibility, tired-day override, same-device history, comparability guard, right/centre targets never escalate leftward progression, fatigue → rest wording, discomfort → stop, habituation guard, dismissal memory, determinism. `src/domain/observation.test.ts` covers provenance and class separation.

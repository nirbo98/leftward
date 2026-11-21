# Exercise decision matrix

**Status: UX decision aid, not medical triage and not an evidence-validated regimen.** Each row is a *product heuristic* chosen for conservatism. Where a row relates to published evidence, the evidence concerns the *general modality* (e.g., visual scanning training in professional rehabilitation), never this app. The family UI shows one suggested task at a time, in plain Hebrew, and always offers בחרו תרגול אחר · הפסקה · סיום · לא ברור.

## Safety gates (always applied first)

| Gate | App behaviour | Basis |
|---|---|---|
| "לא מתאים עכשיו" | No exercise starts. Rest screen + acute-change note. A session record with `endReason: not_fit` is saved for context. | Safety heuristic |
| New/marked deterioration | Non-alarmist note on the readiness screen and at end-on-discomfort: seek immediate clinical assessment, not an app session. The readiness check does **not** certify medical stability. | Safety heuristic |
| Discomfort flagged on a trial | Adaptive engine suggests **stop** (rule R1). | Safety heuristic |
| Fatigue / lost engagement | Suggest **rest** (R2/R3). Never labelled as cognitive worsening. | Safety heuristic; individualised session length/breaks are endorsed in cognitive-rehab guidance (Canadian 2025) |
| Out of scope | No mobility, standing, swallowing, paretic-arm movement, shoulder handling, airway devices, prism simulation, neurostimulation, webcam gaze inference, medication advice. | Handoff §2E; V4 §4F |

## Matrix (implemented)

| Caregiver observation / condition | App suggests | Does NOT default to | Where implemented |
|---|---|---|---|
| Not fit now, unusually unresponsive, discomfort, acute change | No training; stop; acute-change note | Any exercise | `StartFlow` (readiness), `recommendNextStep` R0/R1 |
| Tired but responsive | One huge stationary simple shape; guided left orienting; rest any time | Motion, clutter, conflict tasks, repetitive sound | `recommendStart` S1; tired blocks all demand increases |
| Alert but vision uncertain / no glasses | Huge, high-contrast simple shape; optional visibility preview | Fine watch detail, dense photos, interpreting results as neglect | `recommendStart` S2; R4/R5 simplify (photo → shape, enlarge) |
| Leftward shift mainly after prompting | Guided orienting with optional valid-left cue; personal cue only on demand | Automatic invalid-right cues, rapid timing | Cue ladder; invalid cues OFF (advanced only); no timers |
| Stable cue-responsive left shifting | One cue-fading / unprompted opportunity | Changing several dimensions | R9 (`add_unprompted_trial`), R8 (`reduce_cue`) |
| Some independent leftward exploration | Sparse structured visual scanning (2 objects) | Dense cancellation | R8 (`try_sparse_scanning`), S4 provisional start |
| Stable sparse scanning | +1 distractor, then sparse cancellation-inspired search | Timed clinical test scoring | R8 (`add_one_distractor`, `try_target_search`) |
| Comfortable with static changes **and clinician approval** | Static saccadic relocation; optional very slow pursuit | Flashes, fast optokinetic animation | Pursuit gated by settings approval + not reduced-motion |
| Clinician approved slow motion; tolerates moving displays | Leftward pursuit: 1–3 large objects drifting slowly leftward (SPT-inspired; Kerkhoff 2006/2013) | Fast/full-field optokinetic motion, flashing, use when tired or with reduced motion | `leftward_pursuit` (gated; never auto-suggested) |
| Alert, orienting seems to improve when "woken up" | Alert-then-target: optional non-spatial alert (name, ״שים לב״, soft tone) before a left target, alternating with no-alert trials (Robertson 1998-inspired) | Treating the alert as a directional cue; fixed rapid timing; claiming the alert "works" from the counts | `alert_then_target`; descriptive comparison in Progress |
| Basic engagement, can initiate simple response | Very simple focus/initiation | Flanker / Stroop / task switching (not implemented) | `focus_initiation` |
| Safe ordinary visual task possible | Optional end-of-session transfer prompt (safe visual orienting only) | Mobility, swallowing, arm handling, medical devices | `EndScreen` transfer card |
| Neutral cues ineffective but personal address seems engaging | Name/nickname cue after explicit opt-in | Assuming the name captures spatial attention or is therapy | `PersonalCueManager` (OFF by default); name-only is classed non-spatial |
| Sound distracting, unfamiliar or not localisable | Visual-only; caregiver speech if comfortable | Audio escalation | Sound OFF by default; engine never suggests audio |

## Heuristic vs evidence labels

* **Heuristic (this product):** every threshold (3 comparable observations, 2 cue-dependent observations, distractor caps per size), the cue ladder order, personal-name modes, the transfer prompts, the readiness wording.
* **Indirect evidence (modality-level, see EVIDENCE_LIMITATIONS.md):** visual scanning/exploration training as a rehabilitation option; smooth-pursuit training with leftward-moving displays (small RCTs, Kerkhoff); transient benefit of non-spatial phasic alerting on spatial bias (laboratory, Robertson 1998); individualised, supervised attention practice with adjusted session length and breaks; emphasis on everyday-function observation over task scores.

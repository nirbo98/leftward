# Evidence and limitations

This document traces what Leftward borrows from the literature and — more importantly — what it does **not** claim. It is a pragmatic note for clinicians and developers, not a systematic review.

## The central distinction

| | Evidence status |
|---|---|
| **Therapeutic modalities** (visual scanning/exploration training, individualised attention practice, cueing in rehabilitation) | Some clinical guideline support, generally low/very-low certainty for lasting everyday-function benefit (details below) |
| **Leftward itself** (this cue ladder, suggestion rules, personal-name cueing, sounds, themes, dashboards, home use by family) | **No evidence.** Not studied, not validated. |

Better in-app responses do **not** demonstrate restored covert attention, reduced neglect severity, improved activities of daily living, neural repair, or prognosis. The app does not measure gaze; caregiver-reported overt eye/head shifts are not measures of covert attention.

## Sources checked against primary/publisher text for this build (Nov 2026)

| Source | What it says (paraphrased) | How Leftward uses it |
|---|---|---|
| **AHA/ASA 2026 Guideline for Adult Stroke Rehabilitation and Recovery** (Richards et al., *Stroke* 2026, DOI 10.1161/STR.0000000000000536) | Among visual-impairment interventions: audio-visual spatial exploration training (vs visual exploration alone) is recommended to improve visual scanning in visual-spatial/perceptual deficits. Also found **no added benefit of family-led home-based rehabilitation on top of early supported discharge (Class 3: No Benefit)**. | Supports *scanning/exploration* as a modality only. The family-led-home-rehab finding is a direct caution: Leftward is positioned as a supervised adjunct coordinated with the team, never a substitute. The guideline's audiovisual training refers to specific protocols; it does not validate laptop/iPad speakers, panning, or personalised audio — so sound stays OFF by default. |
| **Canadian Stroke Best Practices**, rehabilitation — visual and visual-perceptual impairment (update cycle 2025; page © 2026) | For unilateral spatial neglect: visual scanning training *may be considered*; mirror therapy *should be used* early post-stroke; limb activation *may be considered*; prisms may be considered but without evidence of functional impact. | Scanning-type practice is in scope. Mirror therapy, limb activation and prisms are **out of scope** for an unsupervised home app. |
| **Cochrane review** — Longley et al. 2021, non-pharmacological interventions for spatial neglect (DOI 10.1002/14651858.CD003586.pub4) | 65 RCTs, 1,951 participants. Effectiveness for persisting improvement in ADL/independence **remains unproven**; evidence very low certainty. Not evidence of ineffectiveness. | Progress view shows observations only; no outcome claims; transfer prompts are optional and labelled as practice, not measurement. |
| **Italian recommendations 2026** — Mancuso et al., *Neurological Sciences* (DOI 10.1007/s10072-026-09115-z) | Conditional recommendation for visuospatial training and for prism adaptation in peripersonal neglect; very low certainty; small, short-term gains. | Same as above; prism adaptation not simulated. Emphasis on ecological, clinician-administered functional assessment → Leftward does not reproduce KF-NAP/CBS or any scale. |
| **Alertness-training RCT** — Van Vleet et al., *Ann Neurol* 2020;88:747–758 | Multisite RCT (n≈49, chronic neglect), 12-week self-administered digital alertness training reduced Posner-task spatial bias and modestly improved functional measures vs active control. | Rationale for checking readiness, short blocks and the optional *focus & initiation* module. Leftward does **not** implement that program, does not measure Posner spatial bias, and cannot generalise its results. |

## Added after literature review (Nov 2026), checked against publisher/PubMed text

| Source | What it says (paraphrased) | How Leftward uses it |
|---|---|---|
| **Kerkhoff, Keller, Ritter & Marquardt 2006**, *Restorative Neurology and Neuroscience* 24:357–369 — repetitive optokinetic stimulation vs visual scanning | Five sessions of repetitive optokinetic stimulation with active pursuit eye movements vs the same amount of conventional visual scanning training with identical stimuli; moving displays with active smooth pursuit can be more efficient than scanning on static displays. | Rationale for the **מעקב אחרי חפצים שנעים שמאלה** exercise (leftward drift). |
| **Kerkhoff, Reinhart, Ziegler, Artinger, Marquardt & Keller 2013**, *Neurorehabilitation and Neural Repair*, DOI 10.1177/1545968313491012 — RCT | Chronic stroke patients with neglect randomised to smooth pursuit training (tracking leftward-moving stimuli) vs visual scanning of the same static stimuli; authors report superior, multimodal (auditory + visual) effects of repetitive contralesional pursuit training in mild and severe neglect. | Same. This is the most specific screen-based evidence the project relies on. |
| **Robertson, Mattingley, Rorden & Driver 1998**, *Nature* 395:169–172, DOI 10.1038/25993 | Brief, non-spatial phasic alerting (tones) before a spatial judgement transiently reduced, abolished or even reversed neglect patients' spatial bias in perceptual awareness. | Rationale for the **שים לב — ואז מטרה** exercise and for treating a name/nickname as a *non-spatial alerting* cue, not a directional cue. |
| **DeGutis & Van Vleet 2010**, *Frontiers in Human Neuroscience* 4:60 — tonic and phasic alertness training | Introduces the alertness-training approach later tested in the 2020 RCT above; argues non-spatial alertness deficits modulate spatial bias. | Context only: the 2020 RCT comes from this research line and has not, to our knowledge, been independently replicated. Check the 2020 paper's conflict-of-interest statement before citing it as independent evidence (not verified here). |

### Critical caveats for the new exercises

* **Not a replication.** Kerkhoff's trials used therapist-run protocols with whole moving displays (optokinetic-type stimulation), defined session counts and durations, and patients able to complete cancellation and auditory tasks. Leftward shows 1–3 large objects drifting slowly leftward on a laptop/iPad, supervised by family. No dose, speed or duration from those trials is claimed. Small samples, largely one research group; the Cochrane review's very-low-certainty rating covers this literature too.
* **Clinician gate kept.** The V4 specification excluded optokinetic stimulation from the MVP; after this review the owner accepted adding a *slow* pursuit exercise, but it stays behind the caregiver-confirmed clinician-approval setting, is disabled by reduced motion, never starts automatically, freezes on pause, and is never suggested by the adaptive engine. Fast optokinetic motion and flashing remain excluded.
* **Robertson 1998 is an experimental effect, not a therapy.** It showed a *transient* within-trial effect of alerting tones in a laboratory task. Leftward's caregiver-timed alert (no fixed sub-second interval, by design) is a different manipulation. The with/without-alert comparison in התקדמות is descriptive, unbalanced, small-N and shows no statistics; it cannot show that alerting helps this patient.
* **Self-relevance remains unreviewed.** Whether a person's own name is a stronger alerting stimulus than a neutral word for patients with neglect was not reviewed. The name feature is grounded in the alerting literature only by analogy.

## Sources from the handoff NOT re-verified in this build

These were listed in RESEARCH_HANDOFF_V2 but could not be opened or were not re-read from primary text here; treat as unverified until checked: ESO 2025 guideline on visual impairment in stroke (publisher page failed to load); Canadian cognitive-rehabilitation section; Cochrane 2019 attention review; KF-NAP/Catherine Bergego review (2012); EAN neglect-screening recommendations; NICE NG236 (2023). No in-app text depends on them.

## Product hypotheses (explicitly unproven)

* Personal salience: a first name/nickname may be attention-grabbing (self-relevance, "cocktail-party" effect — a healthy-participant literature). The closest neglect-specific mechanism is non-spatial phasic alerting (Robertson et al. 1998). There is no clinical evidence that embedding a name in this software rehabilitates neglect, nor that a nickname beats a first name. Name-only cues are logged as **non-spatial**.
* Home use by family: the 2026 AHA/ASA guideline found no added benefit of family-led home-based rehabilitation beyond early supported discharge. Leftward must be positioned as a team-coordinated adjunct.
* Personalised stimuli (vintage cars, watches, family photos) may increase engagement; they may also be harder to see (uncorrected astigmatism). The app starts with large simple shapes and the engine moves back to shapes when visibility is doubtful.
* Cue ladder and cue fading: plausible practice structure; not validated.
* Audio: may help some people and distract others; built-in speakers and panning do not establish localisation.

## Confounds the app records but cannot resolve

Neglect vs left visual-field loss vs oculomotor limitation vs motor-intentional deficit vs generalised attention/arousal failure; uncorrected refractive error; fatigue; posture; screen size/distance; device change; caregiver expectation. The progress view therefore groups by readiness and device and always shows denominators and uncertain outcomes.

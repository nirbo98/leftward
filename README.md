# Leftward (שמאלה)

A privacy-first, offline-capable web app that helps non-technical relatives run **brief, caregiver-supervised visual exploration and leftward-orienting practice** with an adult recovering from right-hemisphere brain injury and suspected left spatial neglect.

> **Not a medical device.** Leftward is a practice companion. It does not diagnose, does not assess neglect, does not track gaze, and does not replace occupational therapy or the rehabilitation team. Its cue sequence, suggestion rules, personalization and dashboards are **not clinically validated**. See [docs/EVIDENCE_LIMITATIONS.md](docs/EVIDENCE_LIMITATIONS.md).

The whole end-user interface is **Hebrew (RTL)**. Developer code and these engineering documents are in English. The patient stimulus area always uses **physical** screen coordinates, so "left" is the physical left of the screen regardless of RTL text layout.

## What it does

| Area | Summary |
|---|---|
| Family flow | Home with three buttons (התחל תרגול · התקדמות · הגדרות ועזרה) → readiness check (ערני ומגיב / עייף אבל מגיב / לא מתאים עכשיו) → optional visibility preview → one adapted exercise explained in one Hebrew sentence. |
| Exercises | Guided left orienting (Posner-inspired, not a Posner task), structured visual scanning, cancellation-inspired target search, static saccadic relocation + optional very slow pursuit, simple focus & initiation, **alert-then-target** (phasic-alerting-inspired, Robertson 1998), **leftward pursuit** (SPT-inspired, Kerkhoff 2006/2013; clinician-approval gate), end-of-session real-world transfer prompt. All use one shared runner and one observation interface. |
| Observations | Caregiver records what was seen: eyes / head / both / unclear / no response / other direction / tired-cannot tell — plus optional "seemed to identify", flags (fatigue, discomfort, visibility, engagement) and manual object marks. Cue order and delivery mode are logged; any response after a cue is never "spontaneous". |
| Personal cues | Optional first name / nicknames stored only on the device, OFF until opt-in. Three delivery modes: caregiver says it aloud (default), on-device Hebrew TTS (fails closed unless a `localService` Hebrew voice is verified offline), imported audio clip of a consenting relative (no in-app recording). |
| Adaptation | Pure, deterministic, rule-based `recommendNextStep()` — one variable at a time, never automatic, never escalates on tired / uncertain / low-visibility trials. See [docs/ADAPTIVE_RULES.md](docs/ADAPTIVE_RULES.md). |
| Progress | Descriptive counts with denominators; uncertain/fatigue outcomes shown, never hidden; no percentages of improvement, no scores, no statistics. |
| Data | IndexedDB only. JSON backup/restore, Hebrew CSV, printable report for the clinical team. Identifiers and family media excluded from exports unless explicitly included. "מחקו את כל הנתונים במכשיר הזה". No sync between devices. |
| Privacy | No camera, microphone, recording, accounts, server, analytics, CDNs or external fonts. Production CSP sets `connect-src 'self'`. ESLint rules + unit tests + `scripts/privacy-audit.mjs` enforce this. |

## Quick start

```bash
npm ci
npm run dev          # http://localhost:5173
npm run verify       # lint + typecheck + unit tests + build + privacy audit
npm run e2e          # Playwright browser tests (needs a Chrome/Chromium; see below)
```

| Script | Purpose |
|---|---|
| `npm run lint` | ESLint, including privacy rules (no `fetch`, `getUserMedia`, `MediaRecorder`, `sendBeacon`, `console`) |
| `npm run typecheck` | Strict TypeScript |
| `npm test` | Vitest unit + UI integration tests (jsdom + fake IndexedDB) |
| `npm run build` | Production build to `dist/` incl. generated offline service worker and CSP |
| `npm run privacy-audit` | Repository + bundle privacy checks (see [docs/PRIVACY_SECURITY.md](docs/PRIVACY_SECURITY.md)) |
| `npm run e2e` | Playwright: Mac desktop, iPad landscape, iPad portrait viewports; `PW_WEBKIT=1` adds a WebKit iPad project |

E2E uses the system Chrome by default (`PW_CHROME_CHANNEL=chrome`). Use `PW_CHROME_CHANNEL=bundled` after `npx playwright install chromium`, and `PW_WEBKIT=1` after `npx playwright install webkit` to exercise the Safari engine.

## Architecture

```
src/
  domain/          pure, tested logic — no React, no I/O
    types.ts         ExerciseDefinition, TrialSpec/Record, CueEvent, Observation, ReadinessContext, VisionContext, StimulusAsset…
    exercises.ts     deterministic seeded stimulus layouts in PHYSICAL x% (0 = physical left)
    runner.ts        shared trial state machine (start, cue, observe, record, undo, pause, repeat)
    observation.ts   cue spatiality + response classification (provenance rules)
    adaptive.ts      recommendNextStep() / recommendStart() / applyChange() — AdaptiveRules
    progress.ts      descriptive summaries with denominators
  services/        audio.ts (Web Audio/HTMLAudio, gesture-only), tts.ts (fail-closed on-device TTS)
  storage/         db.ts (IndexedDB via idb, versioned upgrades), settings.ts, exportImport.ts
  state/           AppState.tsx (context: settings, personal cues, assets, session, runner), router.ts (hash routes)
  components/      PatientStage (dir=ltr, physical `left`), Glyph (original SVG cars/watches/shapes),
                   ObservationPanel, CuePanel (PersonalCueManager delivery), ui primitives, ErrorBoundary
  screens/         Home, StartFlow (ReadinessCheck, VisibilityPreview, AdvancedSetup), ExerciseScreen
                   (ExerciseRunner + CaregiverControls), EndScreen (transfer card), Progress,
                   Settings (PersonalCueManager, Sound, Stimuli/LocalAssets, Motion, Advanced,
                   DataExportImport, OperatorGuide, EvidenceAndSafety)
  pwa/sw-template.js  service-worker template; vite.config.ts fills in the versioned precache list
e2e/               Playwright specs
scripts/           privacy-audit.mjs
docs/              user guide (Hebrew) and engineering/evidence documents
```

Design choices: no UI library (local design system, large controls, system fonts); hash routing for GitHub Pages; relative Vite `base: './'` so the build works under any repository name; strict TypeScript with `noUncheckedIndexedAccess`.

## Mac & iPad (Safari) notes

* Open the deployed URL in Safari. On iPad: Share → "הוספה למסך הבית" to install; on macOS Safari 17+: File → Add to Dock. The installed app then works **offline**.
* Audio never plays without a button press (iPadOS requires a user gesture). The silent switch / Focus modes may mute it; the app works fully without sound.
* Hebrew on-device voices (e.g. built-in Safari voices) are used only if `localService === true` **and** the caregiver completed the offline check. Otherwise TTS stays disabled and the caregiver speaks the name.
* Safari may evict website data for sites not used for a long time. Installing to the Home Screen and keeping periodic backups is recommended. Private browsing may block storage entirely (the app shows a warning).
* Data are **per device and per browser**. Mac and iPad do not sync; use backup → transfer file (AirDrop) → restore.

## Deploying to GitHub Pages

The workflow `.github/workflows/ci-pages.yml` runs lint, typecheck, unit tests, build, privacy audit and Chromium E2E, then deploys `dist/` to Pages on every push to `main`. One-time setup: repository **Settings → Pages → Build and deployment → Source: GitHub Actions**.

```bash
git init -b main && git add -A && git commit -m "Leftward"
gh repo create leftward --public --source . --push      # or --private (Pages on private repos needs a paid plan)
gh api -X POST repos/{owner}/leftward/pages -f build_type=workflow   # enable Pages via Actions
gh run watch                                            # wait for the deploy
# Live at: https://<owner>.github.io/leftward/
```

**Never commit** the private handoff documents, real names/nicknames, family photos/audio, backups, exports or clinical documents. `.gitignore` blocks the common cases; `npm run privacy-audit` checks the repo, and if you create a git-ignored `.privacy-denylist` file with the real name/nickname (one per line) it also scans tracked files, the build and **the entire git history** for them.

After deployment, enter the first name / nickname **only inside the app** (הגדרות ועזרה → פנייה אישית) on each device.

## Limitations of this build

* Automated browser tests ran in Chromium at Mac/iPad viewport sizes. **Real Safari on macOS/iPadOS was not machine-tested** in the build environment; the WebKit CI step is informational. Please do a manual check on both devices (checklist in [docs/PRIVACY_SECURITY.md](docs/PRIVACY_SECURITY.md#manual-device-checklist)).
* TTS behaviour depends on installed voices; the offline verification is a reasonable, not absolute, guarantee of local synthesis.
* Screen-reader support follows standard semantics (labels, roles, focus management) but has not been audited with VoiceOver.

## License

MIT for the source code. The SVG stimuli are original drawings made for this project.

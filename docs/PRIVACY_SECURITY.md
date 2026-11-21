# Privacy and security

## Hard rules (cannot be changed in settings)

* **No camera, webcam, face tracking, microphone, screen capture, or recording of the patient.** The code never calls `getUserMedia`/`getDisplayMedia`/`MediaRecorder`; file inputs have no `capture` attribute. Enforced by ESLint (`no-restricted-properties/globals`), `src/privacy.test.ts`, `scripts/privacy-audit.mjs`, and an E2E check that `getUserMedia` is never invoked.
* **No network use with personal data.** No accounts, server, analytics, telemetry, ads, trackers, CDNs, external fonts, cloud AI or remote TTS. App code contains no `fetch`/XHR/WebSocket/Beacon (lint + tests). The production page has a CSP with `connect-src 'self'`; the service worker serves only same-origin files. An E2E test asserts zero requests to other hosts during the full workflow.
* **Names never leave the device by default.** First name/nicknames live in IndexedDB only; never in source, URLs (hash routes are fixed route names), console logs (`no-console` lint rule), exports (opt-in only), screenshots or fixtures (tests use the placeholder "בדיקה").

## Threat model

| Threat | Mitigation | Residual risk |
|---|---|---|
| Public GitHub repository leaks patient data | `.gitignore` for handoffs, backups, exports, media; privacy audit; optional git-ignored `.privacy-denylist` scanned against tracked files, build output and full git history; demo data fictional | A person could still force-add a file; run `npm run privacy-audit` before every push |
| Shared device (other family members, visitors) | No account; data visible to anyone with the device. "מחקו את כל הנתונים במכשיר הזה" erases IndexedDB + app local storage. | Use the device's own lock screen / user profiles |
| Browser data clearing / Safari eviction | Hebrew warnings; "request persistent storage" button; backups | Data loss if no backup |
| Exported files | Backups/CSV/report exclude identifiers by default; media only on opt-in; Hebrew warning that exported files can be shared | Once saved, files are outside the app's control |
| Private-browsing mode | Storage failure detected → warning banner; practice still possible | Records may not persist |
| On-device TTS sends text to a server | Personal text is spoken only with a Hebrew voice reporting `localService === true`, after an explicit opt-in **and** a successful verification run while `navigator.onLine === false` using a neutral phrase (never the name). Preconditions re-checked at every call; otherwise the mode is disabled with a Hebrew explanation. | `localService` is browser-reported; the offline check is strong evidence but not a formal proof. Caregiver-spoken cues remain the default. |
| Imported family audio/photos | Stored as Blobs in IndexedDB; never uploaded; no in-app recording; size limits; can be previewed, replaced, deleted | Consent of the relative is the family's responsibility (UI reminds them) |
| Malicious/corrupt backup file | Strict format/version check, per-record validation, merge by id, Hebrew errors | — |
| Startling/harmful stimulation | No autoplay; sound OFF by default and gesture-only; low starting volume; one sound at a time; no flashing, countdowns, punitive feedback; reduced-motion honoured; motion only with clinician-approval toggle | Device volume is outside app control |

## Data stored (IndexedDB `leftward`)

`kv/settings`, `kv/personal` (names, cue modes, TTS verification), `sessions`, `trials` (ordered cues, observation, derived class), `assets` (imported images/audio). No gaze coordinates, biometrics, latencies used for scoring, or inferred diagnoses.

## Deletion

* Whole device: Settings → נתונים → מחקו את כל הנתונים במכשיר הזה (deletes the database and `leftward*` localStorage keys; verified by tests to survive reload).
* Single session: Progress → session → מחיקת המפגש.
* Single photo/audio clip: in their settings sections.
* The offline app cache (code only, no personal data) can be removed by the browser's website-data settings.

## Manual device checklist

Run on **macOS Safari** and **iPadOS Safari** (landscape and portrait) before relying on the app:

1. Target appears on the physical left of the screen; Hebrew text right-aligned.
2. No permission prompt of any kind appears during a full session.
3. Sound: silent until enabled; test tone at low volume; iPad silent switch behaviour noted.
4. TTS check: "בדיקה אם יש קול עברי במכשיר" → verification only succeeds with the device offline.
5. Import a relative's audio clip and a photo; preview; delete.
6. Add to Home Screen; switch on airplane mode; the app opens and a session can be recorded.
7. Backup on Mac → AirDrop → restore on iPad; sessions appear once (no duplicates on a second restore).
8. Erase all; reload; history is empty and name fields are blank.
9. VoiceOver: buttons are announced with Hebrew labels; focus moves to page headings on navigation.

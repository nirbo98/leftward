/**
 * Integration tests through the real UI (jsdom + fake IndexedDB).
 * Acceptance: 1 (Hebrew-only, physical-left under RTL), 2 (caregiver-only completion,
 * pause/end), 3–4 (provenance), 6 (sound OFF, manual name cue), 8 (erasure), 12 (disclaimer).
 */
import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { App } from './App';
import * as db from './storage/db';
import { DEFAULT_PERSONAL } from './storage/settings';
import { FAKE_NAME, FAKE_NICK } from './test/fixtures';

const LATIN = /[A-Za-z]/;

function visibleText(): string {
  // Ignore SVG/aria-hidden content; check what the family reads.
  const clone = document.body.cloneNode(true) as HTMLElement;
  clone.querySelectorAll('svg, script, style, [aria-hidden="true"]').forEach((n) => n.remove());
  return clone.textContent ?? '';
}

function expectHebrewOnly() {
  const t = visibleText();
  const offending = t.match(/[A-Za-z]+/g);
  expect(offending).toBeNull();
}

let audioCtor: ReturnType<typeof vi.fn>;
let speak: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  await db.eraseAllData();
  db.__resetDbHandleForTests();
  window.location.hash = '#/';
  audioCtor = vi.fn();
  speak = vi.fn();
  (window as unknown as { AudioContext: unknown }).AudioContext = audioCtor;
  Object.defineProperty(window, 'speechSynthesis', { value: { speak, cancel: vi.fn(), getVoices: () => [] }, configurable: true });
  document.documentElement.setAttribute('dir', 'rtl');
});

async function flowToExercise(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByTestId('home-start'));
  await user.click(await screen.findByTestId('readiness-tired'));
  await user.click(await screen.findByTestId('vision-noticed'));
  expect(screen.getByTestId('start-sentence').textContent).toContain('נתחיל בחפץ אחד גדול');
  await user.click(screen.getByTestId('start-adapted'));
  await screen.findByTestId('show-target');
}

describe('family flow through the UI', () => {
  it('home has exactly the three primary actions, Hebrew-only, with a disclaimer', async () => {
    render(<App />);
    const nav = await screen.findByRole('navigation');
    expect(within(nav).getAllByRole('button').map((b) => b.textContent)).toEqual(['התחל תרגול', 'התקדמות', 'הגדרות ועזרה']);
    expect(screen.getAllByText(/אינו מחליף ריפוי בעיסוק/).length).toBeGreaterThan(0);
    expectHebrewOnly();
  });

  it('"not fit now" never starts an exercise and shows the acute-change safety note', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(await screen.findByTestId('home-start'));
    await user.click(await screen.findByTestId('readiness-not_fit'));
    expect(await screen.findByText(/היום לא מתרגלים/)).toBeInTheDocument();
    expect(screen.getByText(/פנו מיד לצוות הרפואי/)).toBeInTheDocument();
    expect(screen.queryByTestId('patient-stage')).toBeNull();
  });

  it('caregiver completes a session without any patient tap/speech/typing; target is physically left under RTL', async () => {
    const user = userEvent.setup();
    render(<App />);
    await flowToExercise(user);
    expectHebrewOnly();

    await user.click(screen.getByTestId('show-target'));
    const stage = screen.getByTestId('patient-stage');
    expect(document.documentElement.getAttribute('dir')).toBe('rtl');
    expect(stage.getAttribute('dir')).toBe('ltr');
    expect(stage.style.direction).toBe('ltr');
    const target = screen.getByTestId('stim-target');
    expect(target.style.left).toBe('16%'); // physical CSS `left`, not inline-start
    expect(target.style.right).toBe('');
    expect(Number(target.dataset.physicalX)).toBeLessThan(50);
    expect(stage.textContent).toBe(''); // patient area has no text

    // More help → visual cue drawn on the physical left
    await user.click(screen.getByTestId('more-help'));
    expect(screen.getByTestId('visual-cue').dataset.side).toBe('left');
    expect(screen.getByTestId('visual-cue').style.left).toBe('16%');

    // Pause is always available and nothing proceeds on its own
    await user.click(screen.getByTestId('pause'));
    expect(screen.getByTestId('pause-overlay')).toBeInTheDocument();
    await user.click(screen.getByTestId('resume'));

    // Record: eyes left after cue → never "spontaneous"
    await user.click(screen.getByTestId('record'));
    expect(screen.getByTestId('cue-summary').textContent).toContain('רמז חזותי');
    await user.click(screen.getByTestId('obs-eyes'));
    await user.click(screen.getByTestId('obs-head')); // changing the answer before saving
    await user.click(screen.getByTestId('obs-save'));
    await waitFor(async () => expect(await db.listTrials()).toHaveLength(1));
    const [t] = await db.listTrials();
    expect(t!.responseClass).toBe('after_spatial_cue');
    expect(t!.observation.outcome).toEqual({ kind: 'oriented', modality: 'head' });

    // End → reason → summary → progress
    await user.click(screen.getByTestId('end'));
    await user.click(await screen.findByTestId('end-reason-fatigue'));
    expect(await screen.findByTestId('session-summary')).toBeInTheDocument();
    expectHebrewOnly();
    await user.click(screen.getByTestId('finish-session'));
    expect(await screen.findByTestId('progress-counts')).toHaveTextContent('מפגשים: 1 · ניסיונות מתועדים: 1');
    expectHebrewOnly();

    // No audio of any kind happened
    expect(audioCtor).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('no response / unclear / fatigue remain distinct records', async () => {
    const user = userEvent.setup();
    render(<App />);
    await flowToExercise(user);
    for (const k of ['none', 'unclear_kind', 'cannot']) {
      await user.click(screen.getByTestId('show-target'));
      await user.click(screen.getByTestId('record'));
      await user.click(screen.getByTestId(`obs-${k}`));
      await user.click(screen.getByTestId('obs-save'));
    }
    await waitFor(async () => expect(await db.listTrials()).toHaveLength(3));
    const classes = (await db.listTrials()).map((t) => t.responseClass);
    expect(classes).toEqual(['no_response_observed', 'cannot_determine', 'cannot_determine']);
    const outcomes = (await db.listTrials()).map((t) => t.observation.outcome.kind);
    expect(outcomes).toEqual(['no_response_observed', 'oriented', 'cannot_determine']);
  });

  it('manual caregiver name cue works with sound OFF and no permissions; it is logged as a cue, not spontaneous', async () => {
    await db.savePersonal({ ...DEFAULT_PERSONAL, firstName: FAKE_NAME, nicknames: [FAKE_NICK], enabled: true, phrase: 'name_plus_left' });
    const user = userEvent.setup();
    render(<App />);
    await flowToExercise(user);
    await user.click(screen.getByTestId('show-target'));
    await user.click(screen.getByTestId('open-cues'));
    expect(screen.getByTestId('caregiver-name-prompt')).toHaveTextContent('קראו לו בשם או בכינוי המוכר לו ובקשו שיביט לשמאל');
    expect(screen.getByTestId('cue-tone')).toBeDisabled(); // sound off by default
    await user.click(screen.getByTestId('cue-said-nick'));
    await user.click(screen.getByTestId('cue-said-nick')); // repeated call = second cue
    await user.click(screen.getByTestId('cue-close'));
    await user.click(screen.getByTestId('record'));
    await user.click(screen.getByTestId('obs-eyes'));
    await user.click(screen.getByTestId('obs-save'));
    await waitFor(async () => expect(await db.listTrials()).toHaveLength(1));
    const [t] = await db.listTrials();
    expect(t!.cues.map((c) => [c.order, c.type, c.delivery])).toEqual([
      [1, 'nickname', 'caregiver_spoken'],
      [2, 'nickname', 'caregiver_spoken'],
    ]);
    expect(t!.responseClass).toBe('after_nonspatial_cue');
    expect(window.location.href).not.toContain(encodeURIComponent(FAKE_NICK));
    expect(window.location.href).not.toContain(FAKE_NICK);
    expect(audioCtor).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
  });

  it('personal cues are OFF by default: no name prompt is shown', async () => {
    const user = userEvent.setup();
    render(<App />);
    await flowToExercise(user);
    await user.click(screen.getByTestId('show-target'));
    await user.click(screen.getByTestId('open-cues'));
    expect(screen.queryByTestId('caregiver-name-prompt')).toBeNull();
  });

  it('adaptive suggestion appears with לנסות / להמשיך כרגיל / ביטול and changes only on approval', async () => {
    const user = userEvent.setup();
    render(<App />);
    await flowToExercise(user);
    for (let i = 0; i < 2; i++) {
      await user.click(screen.getByTestId('show-target'));
      await user.click(screen.getByTestId('record'));
      await user.click(screen.getByTestId('obs-none'));
      await user.click(screen.getByTestId('obs-save'));
    }
    const card = await screen.findByTestId('suggestion');
    expect(within(card).getByText('הצעה לפי התגובות שתיעדתם')).toBeInTheDocument();
    expect(within(card).getByTestId('suggestion-try')).toHaveTextContent('לנסות');
    expect(within(card).getByTestId('suggestion-continue')).toHaveTextContent('להמשיך כרגיל');
    expect(within(card).getByTestId('suggestion-cancel')).toHaveTextContent('ביטול');
    await user.click(within(card).getByTestId('suggestion-try')); // strengthen: show visual cue at trial start
    await user.click(screen.getByTestId('show-target'));
    expect(screen.getByTestId('visual-cue')).toBeInTheDocument();
  });

  it('settings: Hebrew-only on every section; erase-all works and survives reload', async () => {
    await db.savePersonal({ ...DEFAULT_PERSONAL, firstName: FAKE_NAME, enabled: true });
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(await screen.findByTestId('home-settings'));
    document.querySelectorAll('details').forEach((d) => d.setAttribute('open', ''));
    // user-entered name is shown in its own input; that's the family's own data
    const text = visibleText();
    expect(text.match(/[A-Za-z]+/g)).toBeNull();
    await user.click(screen.getByTestId('erase-all'));
    await user.click(screen.getByTestId('erase-confirm'));
    expect(await screen.findByTestId('data-msg')).toHaveTextContent('כל הנתונים נמחקו');
    unmount();
    db.__resetDbHandleForTests();
    expect((await db.getPersonal()).firstName).toBe('');
    expect(await db.listSessions()).toHaveLength(0);
  });

  it('progress shows denominators and no improvement percentages', async () => {
    const user = userEvent.setup();
    render(<App />);
    await flowToExercise(user);
    await user.click(screen.getByTestId('show-target'));
    await user.click(screen.getByTestId('record'));
    await user.click(screen.getByTestId('obs-eyes'));
    await user.click(screen.getByTestId('obs-save'));
    await user.click(screen.getByTestId('end'));
    await user.click(await screen.findByTestId('end-reason-completed'));
    await user.click(await screen.findByTestId('finish-session'));
    const left = await screen.findByTestId('progress-left');
    expect(left.textContent).toContain('1 מתוך 1');
    expect(document.body.textContent).not.toMatch(/%/);
    expect(document.body.textContent).toContain('מעט ניסיונות');
  });
});


describe('literature-informed exercises in the UI', () => {
  async function toChooser(user: ReturnType<typeof userEvent.setup>) {
    await user.click(await screen.findByTestId('home-start'));
    await user.click(await screen.findByTestId('readiness-alert'));
    await user.click(await screen.findByTestId('vision-noticed'));
    await user.click(screen.getByTestId('start-choose-other'));
  }

  it('every exercise in the chooser has an "על התרגול" explanation', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toChooser(user);
    const toggle = screen.getByTestId('info-toggle-visual_scanning');
    await user.click(within(toggle).getByText('על התרגול'));
    const info = screen.getByTestId('exercise-info-visual_scanning');
    for (const label of ['למה', 'מתי מתאים', 'איך עושים', 'מתי לא']) expect(within(info).getByText(label)).toBeInTheDocument();
    expect(screen.getAllByText('על התרגול')).toHaveLength(7);
  });

  it('leftward pursuit is unavailable until clinician approval is confirmed', async () => {
    const user = userEvent.setup();
    render(<App />);
    await toChooser(user);
    expect(screen.getByTestId('choose-leftward_pursuit')).toBeDisabled();
    expect(screen.getByTestId('choose-leftward_pursuit')).toHaveTextContent('אישור צוות השיקום');
  });

  it('alert-then-target: blank screen, non-spatial alert logged before reveal, target then physically left', async () => {
    await db.savePersonal({ ...DEFAULT_PERSONAL, firstName: FAKE_NAME, enabled: true });
    const user = userEvent.setup();
    render(<App />);
    await toChooser(user);
    await user.click(screen.getByTestId('choose-alert_then_target'));
    await user.click(await screen.findByTestId('show-target'));
    expect(screen.queryByTestId('stim-target')).toBeNull(); // blank before reveal
    expect(screen.getByTestId('alert-planned')).toHaveTextContent('עם התראה');
    await user.click(screen.getByTestId('alert-name'));
    await user.click(screen.getByTestId('reveal-target'));
    expect(screen.getByTestId('stim-target').style.left).toBe('16%');
    await user.click(screen.getByTestId('record'));
    expect(screen.queryByTestId('obs-before-first-cue')).toBeNull(); // impossible before the target existed
    await user.click(screen.getByTestId('obs-eyes'));
    await user.click(screen.getByTestId('obs-save'));
    // Trial 2: planned without alert
    await user.click(screen.getByTestId('show-target'));
    expect(screen.getByTestId('alert-planned')).toHaveTextContent('בלי התראה');
    await user.click(screen.getByTestId('reveal-target'));
    await user.click(screen.getByTestId('record'));
    await user.click(screen.getByTestId('obs-eyes'));
    await user.click(screen.getByTestId('obs-save'));
    await waitFor(async () => expect(await db.listTrials()).toHaveLength(2));
    const t = await db.listTrials();
    expect(t[0]!.cues[0]).toMatchObject({ type: 'first_name', delivery: 'caregiver_spoken', preTarget: true });
    expect(t.map((x) => x.responseClass)).toEqual(['after_nonspatial_cue', 'spontaneous']);
    expect(audioCtor).not.toHaveBeenCalled();
  });
});

describe('no automatic audio', () => {
  it('rendering every screen never constructs an AudioContext', async () => {
    render(<App />);
    await act(async () => {
      for (const r of ['#/start', '#/progress', '#/settings', '#/']) {
        window.location.hash = r;
        window.dispatchEvent(new HashChangeEvent('hashchange'));
        await new Promise((res) => setTimeout(res, 10));
      }
    });
    expect(audioCtor).not.toHaveBeenCalled();
    expect(LATIN.test('')).toBe(false);
  });
});

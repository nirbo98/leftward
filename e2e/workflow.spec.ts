import { expect, test, type Page } from '@playwright/test';

/**
 * Browser E2E — the V4 "definition of done" path, plus privacy, physical-left,
 * offline and motion checks. Fictional placeholder name only ("בדיקה").
 */
const FAKE_NAME = 'בדיקה';
const FAKE_NICK = 'בדיקון';

async function trackPrivacy(page: Page) {
  const foreign: string[] = [];
  page.on('request', (r) => {
    const u = new URL(r.url());
    if (!['127.0.0.1', 'localhost'].includes(u.hostname) && !u.protocol.startsWith('blob') && !u.protocol.startsWith('data')) foreign.push(r.url());
  });
  await page.addInitScript(() => {
    const w = window as unknown as { __mediaCalls: number };
    w.__mediaCalls = 0;
    const md = navigator.mediaDevices;
    if (md) {
      md.getUserMedia = () => {
        w.__mediaCalls++;
        return Promise.reject(new Error('blocked'));
      };
    }
  });
  return foreign;
}

async function setName(page: Page) {
  await page.goto('/#/settings');
  await page.getByTestId('section-personal').locator('summary').click();
  await page.getByTestId('pc-first').fill(FAKE_NAME);
  await page.getByTestId('pc-nick-0').fill(FAKE_NICK);
  await page.getByTestId('pc-save').click();
  await page.getByTestId('pc-enable').check();
  await page.goto('/#/');
}

test('definition of done: tired → giant target → spoken nickname → observe → suggestion → end → history → export → delete', async ({ page }, info) => {
  const foreign = await trackPrivacy(page);
  await page.goto('/');
  await page.getByText('הבנתי').click();
  await setName(page);

  await page.getByTestId('home-start').click();
  await page.getByTestId('readiness-tired').click();
  await page.getByTestId('vision-noticed').click();
  await page.getByTestId('start-adapted').click();

  // Trial 1: spontaneous? No — the caregiver calls the nickname first.
  await page.getByTestId('show-target').click();
  const target = page.getByTestId('stim-target');
  const vp = page.viewportSize()!;
  const box = (await target.boundingBox())!;
  expect(box.x + box.width / 2).toBeLessThan(vp.width / 2); // physically left in an RTL document
  expect(await page.locator('html').getAttribute('dir')).toBe('rtl');
  await page.screenshot({ path: info.outputPath('01-target-left.png') });

  await page.getByTestId('open-cues').click();
  await expect(page.getByTestId('caregiver-name-prompt')).toContainText('קראו לו בשם או בכינוי המוכר לו');
  await page.getByTestId('cue-said-nick').click();
  await page.getByTestId('cue-close').click();
  await page.getByTestId('record').click();
  await page.getByTestId('obs-head').click();
  await page.screenshot({ path: info.outputPath('02-observation.png') });
  await page.getByTestId('obs-save').click();

  // Trials 2–3: no response → conservative, explained suggestion
  for (let i = 0; i < 2; i++) {
    await page.getByTestId('show-target').click();
    await page.getByTestId('record').click();
    await page.getByTestId('obs-none').click();
    await page.getByTestId('obs-save').click();
  }
  await expect(page.getByTestId('suggestion')).toBeVisible();
  await expect(page.getByTestId('suggestion')).toContainText('הצעה לפי התגובות שתיעדתם');
  await page.screenshot({ path: info.outputPath('03-suggestion.png') });
  await page.getByTestId('suggestion-continue').click();

  // Pause / end
  await page.getByTestId('pause').click();
  await expect(page.getByTestId('pause-overlay')).toBeVisible();
  await page.getByTestId('pause-end').click();
  await page.getByTestId('end-reason-fatigue').click();
  await expect(page.getByTestId('session-summary')).toContainText('תועדו 3 ניסיונות');
  await page.getByTestId('finish-session').click();
  await expect(page.getByTestId('progress-counts')).toContainText('ניסיונות מתועדים: 3');
  await page.screenshot({ path: info.outputPath('04-progress.png'), fullPage: true });

  // Export (default: no identifiers)
  await page.goto('/#/settings');
  await page.getByTestId('section-data').locator('summary').click();
  const [dl] = await Promise.all([page.waitForEvent('download'), page.getByTestId('export-backup').click()]);
  const json = await (await import('node:fs/promises')).readFile((await dl.path())!, 'utf8');
  expect(json).toContain('"trials"');
  expect(json).not.toContain(FAKE_NAME);
  expect(json).not.toContain(FAKE_NICK);

  // Name never leaves the device: not in URL, not in localStorage, no foreign requests, no media access
  expect(page.url()).not.toContain(encodeURIComponent(FAKE_NICK));
  expect(await page.evaluate(() => JSON.stringify(localStorage))).not.toContain(FAKE_NICK);
  expect(await page.evaluate(() => (window as unknown as { __mediaCalls: number }).__mediaCalls)).toBe(0);
  expect(foreign).toEqual([]);

  // Delete everything; survives reload
  await page.getByTestId('erase-all').click();
  await page.getByTestId('erase-confirm').click();
  await expect(page.getByTestId('data-msg')).toContainText('נמחקו');
  await page.reload();
  await page.goto('/#/progress');
  await expect(page.getByTestId('progress-counts')).toContainText('מפגשים: 0');
});

test('Hebrew-only visible UI across main screens', async ({ page }) => {
  await page.goto('/');
  const check = async () => {
    const latin = await page.evaluate(() => {
      const c = document.body.cloneNode(true) as HTMLElement;
      c.querySelectorAll('svg,script,style,[aria-hidden="true"]').forEach((n) => n.remove());
      return (c.innerText.match(/[A-Za-z]+/g) ?? []).join(' ');
    });
    expect(latin).toBe('');
  };
  await check();
  await page.goto('/#/settings');
  for (const d of await page.locator('details').all()) await d.evaluate((el) => el.setAttribute('open', ''));
  await check();
  await page.goto('/#/progress');
  await check();
});

test('slow pursuit moves only with approval, freezes on pause, and is disabled by reduced motion', async ({ page, browser }) => {
  await page.goto('/#/settings');
  await page.getByTestId('section-advanced').locator('summary').click();
  await page.getByTestId('advanced-mode').check();
  await page.getByText('צוות השיקום אישר תרגול עם חפצים שנעים לאט').click();
  await page.goto('/#/start');
  await page.getByTestId('readiness-alert').click();
  await page.getByTestId('vision-noticed').click();
  await page.getByTestId('start-advanced').click();
  await page.getByTestId('adv-ex-saccadic_exploration').click();
  await page.getByText('מטרה שנעה לאט מימין לשמאל').click();
  await page.getByTestId('adv-start').click();
  await page.getByTestId('show-target').click();
  const x = async () => Number(await page.getByTestId('stim-target').getAttribute('data-physical-x'));
  const x0 = await x();
  await page.waitForTimeout(1500);
  const x1 = await x();
  expect(x1).toBeLessThan(x0); // drifting toward the physical left
  await page.getByTestId('pause').click();
  const xp = await x();
  await page.waitForTimeout(1000);
  expect(await x()).toBe(xp); // frozen while paused

  // Reduced motion: separate context, approval granted, toggle stays disabled.
  const ctx = await browser.newContext({ reducedMotion: 'reduce', viewport: page.viewportSize()! });
  const p2 = await ctx.newPage();
  await p2.goto(page.url().replace(/#.*$/, '#/settings'));
  await p2.getByTestId('section-advanced').locator('summary').click();
  await p2.getByTestId('advanced-mode').check();
  await p2.getByText('צוות השיקום אישר תרגול עם חפצים שנעים לאט').click();
  await p2.goto(page.url().replace(/#.*$/, '#/start'));
  await p2.getByTestId('readiness-alert').click();
  await p2.getByTestId('vision-noticed').click();
  await p2.getByTestId('start-advanced').click();
  await p2.getByTestId('adv-ex-saccadic_exploration').click();
  await expect(p2.getByRole('checkbox', { name: /מטרה שנעה לאט/ })).toBeDisabled();
  await ctx.close();
});

test('all seven exercises run a real loop with the same observation interface', async ({ page }) => {
  test.setTimeout(180_000); // 14 recorded trials; CI runners are slower
  await page.goto('/#/settings');
  await page.getByTestId('section-advanced').locator('summary').click();
  await page.getByText('צוות השיקום אישר תרגול עם חפצים שנעים לאט').click();
  await expect(page.getByRole('checkbox', { name: /צוות השיקום אישר/ })).toBeChecked();
  // Same-document hash navigation: never reload while the IndexedDB write may be in flight.
  await page.goto('/#/');
  await expect(page.getByTestId('home-start')).toBeVisible();
  for (const id of ['guided_orienting', 'visual_scanning', 'target_search', 'saccadic_exploration', 'focus_initiation', 'alert_then_target', 'leftward_pursuit']) {
    await page.goto('/#/start');
    await page.getByTestId('readiness-alert').click();
    await page.getByTestId('vision-skipped').click();
    await page.getByTestId('start-choose-other').click();
    await expect(page.getByTestId(`choose-${id}`)).toBeEnabled({ timeout: 10_000 });
    await page.getByTestId(`choose-${id}`).click();
    for (let i = 0; i < 2; i++) {
      await page.getByTestId('show-target').click();
      if (id === 'alert_then_target') {
        await expect(page.getByTestId('stim-target')).toHaveCount(0);
        if (i === 0) await page.getByTestId('alert-verbal').click();
        await page.getByTestId('reveal-target').click();
      }
      await expect(page.getByTestId('stim-target')).toBeVisible();
      if (id === 'leftward_pursuit') {
        const x0 = Number(await page.getByTestId('stim-target').getAttribute('data-physical-x'));
        await expect
          .poll(async () => Number(await page.getByTestId('stim-target').getAttribute('data-physical-x')), { timeout: 5000 })
          .not.toBe(x0); // moving (leftward drift; may wrap under heavy load)
      }
      await page.getByTestId('record').click();
      await expect(page.getByTestId('observation-panel')).toBeVisible();
      await page.getByTestId('obs-eyes').click();
      await page.getByTestId('obs-save').click();
    }
    await page.getByTestId('end').click();
    await page.getByTestId('end-reason-completed').click();
    await page.getByTestId('finish-session').click();
    await expect(page.getByTestId('progress-counts')).toBeVisible();
  }
  await expect(page.getByTestId('progress-counts')).toContainText('ניסיונות מתועדים: 14');
});

test('installed PWA launches offline from cache', async ({ page, context }) => {
  await page.goto('/');
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.reload(); // now controlled by the service worker
  await expect(page.getByTestId('home-start')).toBeVisible();
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByTestId('home-start')).toBeVisible();
  await page.getByTestId('home-start').click();
  await expect(page.getByTestId('readiness-alert')).toBeVisible();
  await context.setOffline(false);
});

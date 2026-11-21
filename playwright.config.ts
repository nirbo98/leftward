import { defineConfig, devices } from '@playwright/test';

// WebKit binaries may be unavailable in some CI sandboxes; Chromium (system Chrome) runs everywhere.
const envChannel = process.env.PW_CHROME_CHANNEL ?? 'chrome';
const chromeChannel = envChannel === 'bundled' ? undefined : envChannel;

export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  retries: 0,
  use: { baseURL: 'http://127.0.0.1:4173', locale: 'he-IL', trace: 'off' },
  webServer: { command: 'npx vite preview --port 4173 --strictPort --host 127.0.0.1', url: 'http://127.0.0.1:4173', reuseExistingServer: true, timeout: 60_000 },
  projects: [
    { name: 'mac-desktop', use: { ...devices['Desktop Chrome'], channel: chromeChannel, viewport: { width: 1440, height: 900 } } },
    { name: 'ipad-landscape', use: { ...devices['Desktop Chrome'], channel: chromeChannel, viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: false } },
    { name: 'ipad-portrait', use: { ...devices['Desktop Chrome'], channel: chromeChannel, viewport: { width: 820, height: 1180 }, hasTouch: true, isMobile: false } },
    ...(process.env.PW_WEBKIT ? [{ name: 'webkit-ipad', use: { ...devices['iPad Pro 11 landscape'] } }] : []),
  ],
});

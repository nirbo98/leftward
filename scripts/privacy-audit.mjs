#!/usr/bin/env node
/**
 * Privacy audit for the Leftward repository and build output.
 *
 *  1. No private handoff / clinical documents, backups, exports, or family media tracked in git.
 *  2. No camera/microphone/recording/network/telemetry primitives in app source or the built bundle.
 *  3. No external URLs requested by the built app (CDNs, fonts, analytics).
 *  4. The production HTML carries a strict CSP with connect-src 'self'.
 *  5. OPTIONAL local denylist: put real names/nicknames, one per line, in `.privacy-denylist`
 *     (git-ignored, stays on your computer). The audit then searches all tracked files AND the
 *     full git history for those terms and fails if any appear.
 *
 * Usage: node scripts/privacy-audit.mjs   (run after `npm run build` to include dist/)
 */
import { execSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const problems = [];
const note = (m) => problems.push(m);

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 256 * 1024 * 1024 });
  } catch {
    return '';
  }
}

const inGit = sh('git rev-parse --is-inside-work-tree').trim() === 'true';
const tracked = inGit
  ? sh('git ls-files -z --cached --others --exclude-standard').split('\0').filter(Boolean)
  : walk('.').filter((f) => !f.startsWith('node_modules/') && !f.startsWith('dist/') && !f.startsWith('.git/'));

function walk(dir) {
  return readdirSync(dir).flatMap((n) => {
    const p = dir === '.' ? n : join(dir, n);
    if (n === 'node_modules' || n === '.git') return [];
    return statSync(p).isDirectory() ? walk(p) : [p];
  });
}

// 1. Forbidden files
const forbiddenName = [
  /RESEARCH_HANDOFF/i,
  /MASTER_PROMPT/i,
  /CLAUDE_PROMPT/i,
  /handoff/i,
  /leftward-(backup|export|report)/i,
  /\.(m4a|mp3|wav|aac|ogg|caf|heic|jpe?g|mov|mp4|webm)$/i,
];
const allowedBinary = [/^public\/icons\//, /^docs\/screenshots\//];
for (const f of tracked) {
  if (forbiddenName.some((r) => r.test(f)) && !allowedBinary.some((r) => r.test(f))) note(`Forbidden/private file present: ${f}`);
  if (/\.png$/i.test(f) && !allowedBinary.some((r) => r.test(f))) note(`Unexpected image file (family media must not be committed): ${f}`);
}

// 2. Forbidden APIs in source
const apiPattern = /getUserMedia|getDisplayMedia|MediaRecorder|SpeechRecognition|sendBeacon|XMLHttpRequest|new WebSocket|EventSource|\bcapture\s*=\s*["{]/;
for (const f of tracked.filter((x) => /^src\/.*\.(tsx?|js)$/.test(x) && !/\.test\./.test(x) && !x.startsWith('src/test/'))) {
  const s = readFileSync(f, 'utf8');
  const m = s.match(apiPattern);
  if (m) note(`Forbidden API "${m[0]}" in ${f}`);
  if (!f.endsWith('sw-template.js') && /\bfetch\(/.test(s)) note(`fetch() in app source: ${f}`);
}

// 3–4. Built output
const ALLOWED_URL = [/^http:\/\/www\.w3\.org\//, /^https:\/\/react\.dev\/errors\//, /^https:\/\/reactjs\.org\/docs\/error-decoder/];
if (existsSync('dist')) {
  const distFiles = walk('dist');
  for (const f of distFiles.filter((x) => /\.(js|html|css|webmanifest)$/.test(x))) {
    const s = readFileSync(f, 'utf8');
    for (const u of s.match(/https?:\/\/[^\s'"`)<>\\]+/g) ?? []) {
      if (!ALLOWED_URL.some((r) => r.test(u))) note(`External URL in build output ${f}: ${u}`);
    }
    const m = s.match(/getUserMedia|getDisplayMedia|MediaRecorder|sendBeacon/);
    if (m) note(`Forbidden API "${m[0]}" in build output ${f}`);
  }
  const html = readFileSync('dist/index.html', 'utf8');
  if (!/Content-Security-Policy[^>]*connect-src 'self'/.test(html)) note('dist/index.html lacks CSP with connect-src \'self\'');
  if (!existsSync('dist/sw.js')) note('dist/sw.js (offline service worker) missing');
} else {
  console.log('(dist/ not found — run `npm run build` to audit the bundle too)');
}

// 5. Local denylist (real names) — tracked files and full git history
if (existsSync('.privacy-denylist')) {
  const terms = readFileSync('.privacy-denylist', 'utf8')
    .split(/\r?\n/)
    .map((t) => t.trim())
    .filter((t) => t && !t.startsWith('#'));
  if (inGit && sh('git check-ignore .privacy-denylist').trim() !== '.privacy-denylist') note('.privacy-denylist must be git-ignored');
  const textFiles = tracked.filter((f) => existsSync(f) && statSync(f).size < 5_000_000 && !/\.(png|ico)$/i.test(f));
  const history = inGit ? sh('git log --all -p --no-color') : '';
  const distText = existsSync('dist') ? walk('dist').filter((f) => /\.(js|html|css|json|webmanifest)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n') : '';
  for (const t of terms) {
    for (const f of textFiles) if (readFileSync(f, 'utf8').includes(t)) note(`Denylisted term found in tracked file ${f}`);
    if (history.includes(t)) note('Denylisted term found in git history');
    if (distText.includes(t)) note('Denylisted term found in build output');
  }
  console.log(`Checked ${terms.length} private term(s) from .privacy-denylist (terms not printed).`);
}

if (problems.length) {
  console.error('PRIVACY AUDIT FAILED:');
  for (const p of problems) console.error(' - ' + p);
  process.exit(1);
}
console.log(`Privacy audit passed (${tracked.length} files checked${existsSync('dist') ? ', build output checked' : ''}).`);

import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

const privacyRules = {
  'no-console': 'error',
  'no-restricted-properties': [
    'error',
    { property: 'getUserMedia', message: 'Privacy: camera/microphone access is forbidden in Leftward.' },
    { property: 'getDisplayMedia', message: 'Privacy: screen capture is forbidden.' },
    { property: 'sendBeacon', message: 'Privacy: no telemetry.' },
    { object: 'window', property: 'fetch', message: 'Privacy: no network requests from app code.' },
  ],
  'no-restricted-globals': [
    'error',
    { name: 'fetch', message: 'Privacy: no network requests from app code.' },
    { name: 'XMLHttpRequest', message: 'Privacy: no network requests.' },
    { name: 'WebSocket', message: 'Privacy: no network connections.' },
    { name: 'EventSource', message: 'Privacy: no network connections.' },
    { name: 'MediaRecorder', message: 'Privacy: recording is forbidden.' },
  ],
};

export default tseslint.config(
  { ignores: ['dist', 'node_modules', 'test-results', 'playwright-report', 'src/pwa/sw-template.js'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
  { files: ['src/**/*.{ts,tsx}'], rules: privacyRules },
  { files: ['src/**/*.test.{ts,tsx}', 'src/test/**'], rules: { 'no-restricted-globals': 'off', 'no-restricted-properties': 'off' } },
  { files: ['scripts/**/*.mjs', '*.config.{js,ts}', 'e2e/**'], languageOptions: { globals: globals.node } },
);

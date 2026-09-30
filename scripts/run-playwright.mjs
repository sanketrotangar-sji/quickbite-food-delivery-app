#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const manager = join(fileURLToPath(new URL('.', import.meta.url)), '..', 'apps/manager');

if (process.env.PLAYWRIGHT_SKIP === '1') {
  console.warn('SKIP Playwright (PLAYWRIGHT_SKIP=1)');
  process.exit(0);
}

if (process.env.PLAYWRIGHT !== '1') {
  console.warn(
    'SKIP Playwright smoke (default). Set PLAYWRIGHT=1 after: cd apps/manager && npx playwright install chromium',
  );
  process.exit(0);
}

const run = spawnSync('npx', ['playwright', 'test'], {
  cwd: manager,
  stdio: 'inherit',
  env: process.env,
});

if (run.status !== 0) {
  const out = String(run.stderr || run.stdout || '');
  if (/Executable doesn't exist|browser.*not found/i.test(out)) {
    console.warn('SKIP Playwright: install browsers with npx playwright install chromium');
    process.exit(0);
  }
}

process.exit(run.status ?? 1);

#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const args = ['test', '--allow-env', 'supabase/functions/_shared/'];

function run(cmd, extraArgs) {
  return spawnSync(cmd, [...extraArgs, ...args], { stdio: 'inherit', cwd: root });
}

const local = run('deno', []);
if (local.status === 0) process.exit(0);

console.warn('Local deno not found — using npx deno@2.1.4');
const npx = run('npx', ['--yes', 'deno@2.1.4']);
process.exit(npx.status ?? 1);

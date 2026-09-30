#!/usr/bin/env node
/**
 * Capture Assessment 2 Dev Control Tower artifacts under docs/dct/.
 * Runs unit tests (always) and records paths to RAG/ML evidence.
 */

import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_DIR = join(ROOT, 'docs/dct');

mkdirSync(OUT_DIR, { recursive: true });

function run(cmd, args) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf8',
    env: process.env,
    shell: false,
  });
  return {
    status: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || '',
  };
}

const started = new Date().toISOString();
console.log('Running npm run test:unit…');
const unit = run('npm', ['run', 'test:unit']);
const unitLog = [
  `# QuickBite — unit test capture`,
  ``,
  `Captured: ${started}`,
  `Command: npm run test:unit`,
  `Exit code: ${unit.status}`,
  ``,
  `## stdout`,
  ``,
  '```',
  unit.stdout.trim() || '(empty)',
  '```',
  ``,
  `## stderr`,
  ``,
  '```',
  unit.stderr.trim() || '(empty)',
  '```',
  ``,
].join('\n');

writeFileSync(join(OUT_DIR, 'test-run-unit.md'), unitLog);

console.log('Running npm run test:edge…');
const edge = run('npm', ['run', 'test:edge']);
const edgeLog = [
  `# QuickBite — edge test capture`,
  ``,
  `Captured: ${new Date().toISOString()}`,
  `Command: npm run test:edge`,
  `Exit code: ${edge.status}`,
  ``,
  '```',
  (edge.stdout + '\n' + edge.stderr).trim() || '(empty)',
  '```',
  ``,
].join('\n');
writeFileSync(join(OUT_DIR, 'test-run-edge.md'), edgeLog);

const integration = run('npm', ['run', 'test:integration']);
writeFileSync(
  join(OUT_DIR, 'test-run-integration.md'),
  [
    `# QuickBite — integration capture`,
    ``,
    `Captured: ${new Date().toISOString()}`,
    `Command: npm run test:integration`,
    `Exit code: ${integration.status}`,
    ``,
    '```',
    (integration.stdout + '\n' + integration.stderr).trim() || '(empty)',
    '```',
    ``,
    `Note: exits 0 and skips when SUPABASE_SERVICE_ROLE_KEY is missing.`,
    ``,
  ].join('\n'),
);

const ragReport = join(ROOT, 'docs/rag/evaluation-report.md');
const mlMetrics = join(ROOT, 'docs/ml/classification-metrics.json');
const mlMatrix = join(ROOT, 'docs/ml/confusion_matrix.png');

const evidence = {
  captured_at: started,
  unit_exit_code: unit.status,
  edge_exit_code: edge.status,
  integration_exit_code: integration.status,
  rag_evaluation_report: existsSync(ragReport) ? 'docs/rag/evaluation-report.md' : null,
  ml_metrics: existsSync(mlMetrics) ? 'docs/ml/classification-metrics.json' : null,
  ml_confusion_matrix_png: existsSync(mlMatrix) ? 'docs/ml/confusion_matrix.png' : null,
  ml_accuracy: existsSync(mlMetrics)
    ? JSON.parse(readFileSync(mlMetrics, 'utf8')).accuracy
    : null,
};

writeFileSync(join(OUT_DIR, 'evidence-index.json'), JSON.stringify(evidence, null, 2) + '\n');

console.log(`Wrote docs/dct/ (unit exit=${unit.status}, edge exit=${edge.status}, integration exit=${integration.status})`);
// Prefer unit as the gate; edge may fail without network/deno in CI sandboxes.
const code = unit.status !== 0 ? unit.status : 0;
process.exit(code);

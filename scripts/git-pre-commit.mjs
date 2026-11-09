#!/usr/bin/env node
/**
 * Git pre-commit: block secrets and .env files. Then run check-secrets-hygiene.
 */

import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");

function fail(message) {
  console.error(message);
  process.exit(1);
}

const staged = spawnSync(
  "git",
  ["diff", "--cached", "--name-only", "--diff-filter=ACM"],
  { cwd: root, encoding: "utf8" },
);

if (staged.status !== 0) {
  fail(`pre-commit: could not list staged files\n${staged.stderr || ""}`);
}

const files = staged.stdout
  .split("\n")
  .map((line) => line.trim())
  .filter(Boolean);

const blocked = files.filter((file) => {
  const base = file.split("/").pop() ?? file;
  if (base === ".env.example" || base.endsWith(".env.example")) return false;
  if (base === ".env" || /^\.env\./.test(base)) return true;
  if (base === "credentials.json" || base === "google-services.json") return true;
  return false;
});

if (blocked.length) {
  fail(
    `pre-commit: refusing to commit secret/config files:\n${blocked.map((f) => ` - ${f}`).join("\n")}`,
  );
}

const hygiene = spawnSync("node", ["scripts/check-secrets-hygiene.mjs"], {
  cwd: root,
  encoding: "utf8",
  stdio: "inherit",
});

if (hygiene.status !== 0) {
  process.exit(hygiene.status ?? 1);
}

console.log("pre-commit: ok");

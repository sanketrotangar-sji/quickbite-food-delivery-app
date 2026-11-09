#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const guard = join(root, ".cursor/hooks/shell-guard.mjs");

const cases = [
  ["git status", "allow"],
  ["npm test", "allow"],
  ["git commit -m hi", "ask"],
  ["git push origin HEAD", "ask"],
  ["docker compose up", "ask"],
  ["git push --force origin main", "deny"],
  ["supabase db reset", "deny"],
  ["git reset --hard", "deny"],
  ["git config user.email x", "deny"],
];

let failed = 0;
for (const [command, expected] of cases) {
  const result = spawnSync("node", [guard], {
    input: JSON.stringify({ command }),
    encoding: "utf8",
  });
  let permission = "error";
  try {
    permission = JSON.parse(result.stdout).permission;
  } catch {
    failed += 1;
    console.error("FAIL parse", command, result.stdout, result.stderr);
    continue;
  }
  const ok = permission === expected;
  if (!ok) failed += 1;
  console.log(`${ok ? "ok" : "FAIL"}  ${expected.padEnd(5)} got=${permission}  ${command}`);
}

process.exit(failed ? 1 : 0);

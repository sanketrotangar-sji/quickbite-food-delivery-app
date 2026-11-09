#!/usr/bin/env node
/**
 * Copy repo git hooks into .git/hooks (no git config).
 * Safe to run when .git is missing (CI pack).
 */

import { chmodSync, copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const gitDir = join(root, ".git");
const srcDir = join(root, ".githooks");
const destDir = join(gitDir, "hooks");

if (!existsSync(gitDir)) {
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
const src = join(srcDir, "pre-commit");
const dest = join(destDir, "pre-commit");
copyFileSync(src, dest);
chmodSync(dest, 0o755);

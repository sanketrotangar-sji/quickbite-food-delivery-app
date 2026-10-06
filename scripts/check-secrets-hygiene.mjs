#!/usr/bin/env node
/**
 * Fail CI/local test if service-role secrets or admin clients leak into client bundles.
 *
 * Checks:
 * 1. apps/client/src must not mention SUPABASE_SERVICE_ROLE / service_role keys.
 * 2. apps/manager/src must not import client.server from routes or non-*.server modules
 *    (except the client.server.ts file itself).
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const errors = [];

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === "dist" || name === ".output") continue;
    const path = join(dir, name);
    const st = statSync(path);
    if (st.isDirectory()) walk(path, out);
    else if (/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(name)) out.push(path);
  }
  return out;
}

const clientSrc = join(root, "apps/client/src");
for (const file of walk(clientSrc)) {
  const text = readFileSync(file, "utf8");
  if (/SUPABASE_SERVICE_ROLE|service_role/i.test(text)) {
    errors.push(
      `Forbidden service-role reference in client: ${relative(root, file)}`,
    );
  }
}

const managerSrc = join(root, "apps/manager/src");
const allowedServerImportHosts = new Set([
  join(managerSrc, "integrations/supabase/client.server.ts"),
]);

for (const file of walk(managerSrc)) {
  if (file.endsWith("client.server.ts")) continue;
  const rel = relative(managerSrc, file).replace(/\\/g, "/");
  const isServerModule =
    /\.server\.(ts|tsx|js|jsx)$/.test(rel) ||
    rel.startsWith("server.") ||
    rel === "server.ts" ||
    rel === "start.ts";
  const text = readFileSync(file, "utf8");
  const importsAdmin =
    /integrations\/supabase\/client\.server/.test(text) ||
    /from\s+['"]@\/integrations\/supabase\/client\.server['"]/.test(text);

  if (!importsAdmin) continue;

  if (rel.startsWith("routes/") || /\.(tsx|jsx)$/.test(rel) || !isServerModule) {
    if (!allowedServerImportHosts.has(file)) {
      errors.push(
        `Unsafe import of client.server from ${relative(root, file)} (server-only modules may import it)`,
      );
    }
  }
}

if (errors.length) {
  console.error("check-secrets-hygiene failed:\n" + errors.map((e) => ` - ${e}`).join("\n"));
  process.exit(1);
}

console.log("check-secrets-hygiene: ok");

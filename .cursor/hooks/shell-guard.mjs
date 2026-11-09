#!/usr/bin/env node
/**
 * Cursor beforeShellExecution: deny destructive git/docker/db/env,
 * ask for writes, allow read-only and tests.
 *
 * Reads hook JSON on stdin. Prints { permission, user_message?, agent_message? }.
 */

import { readFileSync } from "node:fs";

function reply(permission, userMessage, agentMessage) {
  const out = { permission };
  if (userMessage) out.user_message = userMessage;
  if (agentMessage) out.agent_message = agentMessage;
  process.stdout.write(JSON.stringify(out));
}

function readInput() {
  try {
    const raw = readFileSync(0, "utf8").trim();
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function classify(command) {
  const c = command.replace(/\s+/g, " ").trim();
  if (!c) return { permission: "allow" };

  const deny = [
    {
      re: /\bgit\s+push\b[\s\S]*(\s--force-with-lease\b|\s--force\b|\s-f\b)/,
      why: "Force-push is blocked. Ask the human if this is truly needed.",
    },
    {
      re: /\bgit\s+reset\s+--hard\b/,
      why: "git reset --hard is blocked. It discards work.",
    },
    {
      re: /\bgit\s+clean\b[\s\S]*\s-[a-zA-Z]*f/,
      why: "git clean -f is blocked. It deletes untracked files.",
    },
    {
      re: /\bgit\s+config\b/,
      why: "git config is blocked. Do not change git config.",
    },
    {
      re: /\brm\s+-[a-zA-Z]*r[a-zA-Z]*f\b|\brm\s+-[a-zA-Z]*f[a-zA-Z]*r\b/,
      why: "rm -rf is blocked.",
    },
    {
      re: /\bdocker\s+system\s+prune\b/,
      why: "docker system prune is blocked.",
    },
    {
      re: /\bdocker(-compose)?\s+compose\s+down\b[\s\S]*(-v\b|--volumes\b)|\bdocker-compose\s+down\b[\s\S]*(-v\b|--volumes\b)/,
      why: "docker compose down -v is blocked. It deletes volumes.",
    },
    {
      re: /\bsupabase\s+db\s+reset\b|\bnpm\s+run\s+db:reset\b/,
      why: "supabase db reset is blocked. It wipes the database.",
    },
    {
      re: /(^|[^\w-])(>|>>)\s*\.env(\s|$)|tee\s+\.env\b/,
      why: "Writing .env is blocked.",
    },
    {
      re: /\b(printenv|echo|cat|env)\b[\s\S]*SERVICE_ROLE|\bSUPABASE_SERVICE_ROLE_KEY\s*=/,
      why: "Printing or assigning the service-role key is blocked.",
    },
    {
      re: /\b--no-verify\b|\b--no-gpg-sign\b/,
      why: "Skipping git hooks is blocked unless the human explicitly asked.",
    },
  ];

  for (const rule of deny) {
    if (rule.re.test(c)) {
      return {
        permission: "deny",
        user_message: rule.why,
        agent_message: rule.why,
      };
    }
  }

  const ask = [
    {
      re: /\bgit\s+(commit|push|add|checkout|switch|merge|rebase|stash|tag|cherry-pick|restore|mv|rm)\b|\bgit\s+branch\s+-[dDmM]/,
      why: "Git write. Approve if you asked for this.",
    },
    {
      re: /\bdocker(-compose)?\b|\bpodman\b/,
      why: "Docker. Approve if you asked for this.",
    },
    {
      re: /\bsupabase\s+(db\s+push|functions\s+deploy|secrets\s+set)\b|\bnpm\s+run\s+(db:push|functions:deploy|seed:push)\b/,
      why: "This changes cloud Supabase. Approve if you asked for this.",
    },
  ];

  for (const rule of ask) {
    if (rule.re.test(c)) {
      return {
        permission: "ask",
        user_message: rule.why,
        agent_message: rule.why,
      };
    }
  }

  return { permission: "allow" };
}

const input = readInput();
if (input == null) {
  reply("deny", "Hook could not parse its input.", "shell-guard: invalid JSON on stdin");
  process.exit(0);
}

const command = typeof input.command === "string" ? input.command : "";
const result = classify(command);
reply(result.permission, result.user_message, result.agent_message);

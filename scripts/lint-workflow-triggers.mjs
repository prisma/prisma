#!/usr/bin/env node
/**
 * Forbids `pull_request_target` in `.github/workflows/**`.
 *
 * Why: `pull_request_target` runs in the **base repository's trust
 * context** (with secrets and a writable `GITHUB_TOKEN`) but, by design,
 * fires for PRs from forks. If such a workflow ever checks out and
 * executes the PR's code — directly, transitively (e.g. via a shared
 * cache restored from a fork-PR run), or indirectly (e.g. via an action
 * that reads PR metadata into a shell command) — fork-controlled code
 * runs with the base repo's permissions. This is GitHub's "Pwn Request"
 * pattern, and it is the entry point of the May 2026 TanStack
 * compromise that published 84 malicious npm packages.
 *
 *   https://tanstack.com/blog/npm-supply-chain-compromise-postmortem
 *   https://securitylab.github.com/resources/github-actions-preventing-pwn-requests/
 *
 * The class of failure is wider than the obvious "checkout the fork
 * branch" pattern: cache poisoning across the fork↔base boundary, third-
 * party action steps that materialise PR metadata, and OIDC token
 * minting from an `id-token: write` workflow are all reachable from a
 * single `pull_request_target` declaration.
 *
 * The repo currently uses `pull_request` (which sandboxes fork PRs to a
 * read-only token with no secrets) and gates fork-PR runs behind first-
 * time-contributor approval. We do not have a legitimate
 * `pull_request_target` use case today. If one is ever proposed, it
 * should be reviewed by code owners on its own merits and explicitly
 * removed from this guardrail in the same change.
 *
 * The lint matches `pull_request_target` outside YAML comments. A
 * single comment-stripping pass is good enough for our workflow files;
 * we do not try to fully emulate YAML quoting rules. Mentions inside a
 * quoted string would be an unusual construction and worth surfacing.
 *
 * Exits with code 1 and prints offending locations if any violations
 * are found; exits with code 0 otherwise.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const FORBIDDEN_TOKEN = 'pull_request_target';

export function stripYamlComment(line) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === "'" && !inDouble) inSingle = !inSingle;
    else if (ch === '"' && !inSingle) {
      // YAML double-quoted scalars allow `\"` as an escaped quote. An odd run
      // of consecutive backslashes immediately before this `"` means the quote
      // is escaped (data, not a terminator); an even run (including zero)
      // means it terminates / opens a scalar.
      let backslashes = 0;
      for (let j = i - 1; j >= 0 && line[j] === '\\'; j--) backslashes++;
      if (backslashes % 2 === 0) inDouble = !inDouble;
    } else if (ch === '#' && !inSingle && !inDouble) {
      const prev = i === 0 ? ' ' : line[i - 1];
      if (prev === ' ' || prev === '\t' || i === 0) {
        return line.slice(0, i);
      }
    }
  }
  return line;
}

export function findViolations(source) {
  const lines = source.split(/\r?\n/);
  const hits = [];
  for (let i = 0; i < lines.length; i++) {
    const stripped = stripYamlComment(lines[i]);
    const idx = stripped.search(new RegExp(`\\b${FORBIDDEN_TOKEN}\\b`));
    if (idx !== -1) {
      hits.push({ line: i + 1, column: idx + 1, text: lines[i] });
    }
  }
  return hits;
}

function listWorkflowFiles(dir) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }
  const files = [];
  for (const name of entries) {
    const full = join(dir, name);
    if (!statSync(full).isFile()) continue;
    if (name.endsWith('.yml') || name.endsWith('.yaml')) files.push(full);
  }
  return files;
}

export function runCheck({ root = repoRoot } = {}) {
  const dir = join(root, '.github', 'workflows');
  const files = listWorkflowFiles(dir);
  const offences = [];
  for (const file of files) {
    const source = readFileSync(file, 'utf8');
    const hits = findViolations(source);
    if (hits.length > 0) {
      offences.push({ file: relative(root, file), hits });
    }
  }
  return offences;
}

function main() {
  const offences = runCheck();
  if (offences.length === 0) {
    return 0;
  }
  console.error(`Forbidden trigger '${FORBIDDEN_TOKEN}' detected in workflow files:\n`);
  for (const { file, hits } of offences) {
    for (const hit of hits) {
      console.error(`  ${file}:${hit.line}:${hit.column}  ${hit.text.trim()}`);
    }
  }
  console.error(
    `\n${FORBIDDEN_TOKEN} runs with the base repo's secrets and is the ` +
      '"Pwn Request" entry point. See docs/oss/supply-chain.md and ' +
      'scripts/lint-workflow-triggers.mjs for context.',
  );
  return 1;
}

if (import.meta.url === 'file://' + process.argv[1]) {
  process.exit(main());
}

#!/usr/bin/env node
/**
 * The old `prisma-next` name does not come back.
 *
 * Prisma 8 publishes 17 packages under `@prisma/*`, its repository is
 * `prisma/prisma`, and its examples read `prisma-8-*`. The working name
 * survives in a few places that are either a record of what really shipped or
 * a user-facing name that cannot be changed without an upgrade path. Every
 * other occurrence is a mistake, and this check is what keeps it from
 * accumulating again.
 *
 * There is no threshold and no count. Each allowance below is a category with
 * a reason, and the two that are temporary name the roadmap task that removes
 * them — so an allowance cannot quietly become permanent.
 *
 * Exit codes:
 *   0 — no disallowed occurrence
 *   1 — at least one, named by file and line
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GIT_ROOT = process.cwd();

const LEGACY = 'prisma-next';

/** The roadmap task both temporary allowances are waiting on. */
const ROADMAP_TASK = 'ROADMAP.md § 3, "Decide the config filename and the command name"';

/**
 * An occurrence that is allowed, with the reason. Each returns true when it
 * recognises the occurrence as its own kind.
 *
 * Allowances are tested against a single occurrence — the text before and
 * after it — rather than the whole line, because one line can hold both an
 * allowed and a disallowed use. `prisma-next contract emit` inside a comment
 * that also names `@internal/cli` must fail on the second without the first
 * excusing it.
 *
 * Order does not matter — an occurrence needs only one allowance to pass.
 */
const ALLOWED = [
  {
    why: 'a dated record of past work — the changelog, the release notes, the ADRs, and the `projects/` and `drive/` write-ups. Each says what was true, decided, or observed at a time when the old name was the name; rewriting one would misreport it',
    matches: (relPath) =>
      /^(CHANGELOG\.md|docs\/releases\/v[^/]*\.md|docs\/architecture docs\/adrs\/|projects\/|drive\/)/.test(
        relPath,
      ),
  },
  {
    why: 'a link pinned to something in the old repository — a pull request, issue, commit or release by number, or a file at a released tag — or a Linear ticket whose URL carries a generated slug. Each names a thing that exists there and only there, so repointing would send the reader somewhere else entirely',
    matches: (relPath, line, before, after) =>
      (/prisma\/$/.test(before) &&
        /^\/(?:pull|issues|commit|compare|releases|blob\/v[\d.]|tree\/v[\d.])\b/.test(after)) ||
      /linear\.app\/[^\s)]*$/.test(before),
  },
  {
    why: `a name a user types or a path in their project — the published bin \`prisma-next\`, the \`prisma-next.config.ts\` it reads, the \`prisma-next.md\` and \`.prisma-next/\` it writes, the per-user \`config/prisma-next/\` directory, and the shim package carrying the bin. Renaming any of these is a breaking change needing an upgrade path, tracked in ${ROADMAP_TASK}`,
    matches: (relPath, line, before, after) => {
      // Never the package scope, and never a path inside the old repository —
      // those are what this check exists to catch.
      if (/@$/.test(before)) return false;
      if (/(?:github\.com\/)?prisma\/$/.test(before)) return false;
      // The shim package that carries the bin.
      if (/^packages\/9-public\/prisma-next\//.test(relPath)) return true;
      // The files and directories the command reads and writes.
      if (/^\.(?:config|md|png)\b/.test(after)) return true;
      if (/\.$/.test(before) && /^-regen\.config/.test(after)) return true;
      // The bare command, and the directories named after it.
      return !/^[-\w]/.test(after);
    },
  },
  {
    why: `the published skill cluster — users install these by name (\`skills add prisma/prisma#v<version>\`), so the directory names are user-facing and move with the same sweep as the command name, tracked in ${ROADMAP_TASK}`,
    matches: (relPath, line, before, after) =>
      /^skills\//.test(relPath) ||
      (/skills\/(?:upgrade\/|extension-author\/)?$/.test(before) && /^[-/]/.test(after)) ||
      /^-(?:quickstart|contract|migrations|migration-review|queries|supabase|runtime|build|debug|feedback|upgrade|extension-upgrade)\b/.test(
        after,
      ),
  },
  {
    why: 'the roadmap narrates the move out of the old repository, so naming it is the point of the sentence',
    matches: (relPath) => /^ROADMAP\.(?:md|html)$/.test(relPath),
  },
];

const SKIP_PATH = /(^|\/)(node_modules|dist|dist-tsc|dist-tsc-prod|coverage|\.turbo)\//;
const BINARY = /\.(png|jpg|jpeg|gif|ico|svg|woff2?|ttf|eot|pdf|zip|tgz|wasm)$/i;

export function trackedFiles(scanDir) {
  return execFileSync('git', ['ls-files', '-z'], {
    cwd: scanDir,
    encoding: 'utf-8',
    stdio: 'pipe',
    maxBuffer: 256 * 1024 * 1024,
  })
    .split('\0')
    .filter(Boolean)
    .filter((relPath) => !SKIP_PATH.test(relPath) && !BINARY.test(relPath));
}

/**
 * The allowance covering one occurrence, or undefined when none does.
 *
 * `at` is the index of the occurrence within `line`; it defaults to the first,
 * which is what a caller checking a single-occurrence string wants.
 */
export function allowanceFor(relPath, line, at = line.indexOf(LEGACY)) {
  const before = line.slice(0, at);
  const after = line.slice(at + LEGACY.length);
  return ALLOWED.find((allowance) => allowance.matches(relPath, line, before, after));
}

/** Every occurrence in `scanDir` that no allowance covers. */
export function findViolations(scanDir, files = trackedFiles(scanDir)) {
  const violations = [];
  for (const relPath of files) {
    let content;
    try {
      content = readFileSync(join(scanDir, relPath), 'utf-8');
    } catch {
      continue;
    }
    if (!content.includes(LEGACY)) continue;
    content.split('\n').forEach((line, index) => {
      for (let at = line.indexOf(LEGACY); at !== -1; at = line.indexOf(LEGACY, at + 1)) {
        if (allowanceFor(relPath, line, at) !== undefined) continue;
        violations.push({ file: relPath, line: index + 1, column: at + 1, text: line.trim() });
        return;
      }
    });
  }
  return violations;
}

export function main(scanDir = GIT_ROOT) {
  const violations = findViolations(scanDir);
  if (violations.length === 0) {
    console.log(`No disallowed \`${LEGACY}\` occurrence.`);
    return 0;
  }

  console.error(`${violations.length} disallowed \`${LEGACY}\` occurrence(s):\n`);
  for (const violation of violations.slice(0, 40)) {
    console.error(`  ${violation.file}:${violation.line}: ${violation.text.slice(0, 140)}`);
  }
  if (violations.length > 40) console.error(`  … and ${violations.length - 40} more`);
  console.error(
    '\nPrisma 8 publishes under `@prisma/*` from `prisma/prisma`. The old name is\n' +
      'allowed only where it is a record of what shipped, a link into the old\n' +
      'repository by number, or a user-facing name waiting on an upgrade path:\n',
  );
  for (const allowance of ALLOWED) console.error(`  - ${allowance.why}\n`);
  return 1;
}

if (process.argv[1] === import.meta.filename) process.exit(main());

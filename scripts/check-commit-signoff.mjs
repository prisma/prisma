#!/usr/bin/env node
/**
 * `commit-msg` hook: enforces that every commit carries a `Signed-off-by:`
 * trailer matching the commit author identity (name + email).
 *
 * This is the local mirror of the DCO requirement documented in
 * [`CONTRIBUTING.md`](../CONTRIBUTING.md#developer-certificate-of-origin-dco):
 * catching missing or mismatched sign-offs at `git commit` time means the
 * remote DCO status check never has to fail the PR.
 *
 * Author identity is sourced from `git var GIT_AUTHOR_IDENT`, which already
 * resolves `user.name` / `user.email`, the `GIT_AUTHOR_*` env vars, and any
 * `--author=` override passed to `git commit`. We match on author rather than
 * committer because that is what the DCO actually requires (and what the
 * GitHub-side check enforces); on a normal local commit the two identities
 * are the same person anyway.
 *
 * Skipped (no sign-off required):
 *   - merge commits (subject begins with "Merge ")
 *   - fixup! / squash! / amend! commits — these are rewritten on rebase, and
 *     `git rebase --autosquash` preserves the target commit's sign-off
 *   - empty messages (git itself will already abort the commit)
 *
 * Bypass for the rare legitimate case with `git commit --no-verify`.
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

// `git var GIT_AUTHOR_IDENT` format: "Name <email> <unix-ts> <tz>"
const AUTHOR_IDENT_RE = /^(.*)\s+<([^>]+)>\s+\d+\s+[+-]?\d+$/;

// Git trailer keys are matched case-insensitively; the canonical form is
// `Signed-off-by:` but `signed-off-by:` etc. are accepted by `git interpret-trailers`.
const SIGNOFF_RE = /^\s*signed-off-by:\s*(.+?)\s+<([^>]+)>\s*$/i;

// The body of git's `commit.cleanup=scissors` marker; the leading character
// is `core.commentChar` (defaults to `#`), so we prepend it at call time
// rather than hardcoding `#` here.
const SCISSORS_BODY = ' ------------------------ >8 ------------------------';

export function parseAuthorIdent(ident) {
  const m = ident.match(AUTHOR_IDENT_RE);
  if (!m) return null;
  return { name: m[1].trim(), email: m[2].trim() };
}

export function stripCommentsAndScissors(message, commentChar = '#') {
  const scissorsLine = `${commentChar}${SCISSORS_BODY}`;
  const lines = message.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    if (line === scissorsLine) break;
    if (line.startsWith(commentChar)) continue;
    out.push(line);
  }
  return out.join('\n');
}

export function classifySubject(message) {
  const trimmed = message.replace(/^\s+/, '');
  if (trimmed.length === 0) return 'empty';
  if (/^Merge /.test(trimmed)) return 'merge';
  if (/^(fixup|squash|amend)!/.test(trimmed)) return 'fixup-squash-amend';
  return 'normal';
}

export function extractSignoffs(message) {
  const signoffs = [];
  for (const raw of message.split(/\r?\n/)) {
    const m = raw.match(SIGNOFF_RE);
    if (m) signoffs.push({ name: m[1].trim(), email: m[2].trim() });
  }
  return signoffs;
}

export function matchesAuthor(signoff, author) {
  return signoff.name === author.name && signoff.email.toLowerCase() === author.email.toLowerCase();
}

export function check(rawMessage, authorIdent, { commentChar = '#' } = {}) {
  const author = parseAuthorIdent(authorIdent);
  if (!author) {
    return { ok: false, reason: 'unparseable-author', authorIdent };
  }
  const message = stripCommentsAndScissors(rawMessage, commentChar);
  const subjectKind = classifySubject(message);
  if (subjectKind !== 'normal') {
    return { ok: true, skip: subjectKind };
  }
  const signoffs = extractSignoffs(message);
  if (signoffs.length === 0) {
    return { ok: false, reason: 'missing-signoff', author };
  }
  if (!signoffs.some((s) => matchesAuthor(s, author))) {
    return { ok: false, reason: 'mismatched-signoff', author, signoffs };
  }
  return { ok: true };
}

function getCommentChar() {
  try {
    const value = execFileSync('git', ['config', '--get', 'core.commentChar'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
    // `auto` means git picks a character per commit; conservatively fall back to '#'.
    if (!value || value === 'auto') return '#';
    return value[0];
  } catch {
    return '#';
  }
}

function main(argv) {
  const msgPath = argv[2];
  if (!msgPath) {
    console.error('check-commit-signoff: missing commit message path argument');
    return 2;
  }
  const rawMessage = readFileSync(msgPath, 'utf8');
  const authorIdent = execFileSync('git', ['var', 'GIT_AUTHOR_IDENT'], {
    encoding: 'utf8',
  }).trim();
  const result = check(rawMessage, authorIdent, { commentChar: getCommentChar() });
  if (result.ok) return 0;

  if (result.reason === 'unparseable-author') {
    console.error(`check-commit-signoff: could not parse author identity: ${result.authorIdent}`);
    return 1;
  }
  if (result.reason === 'missing-signoff') {
    console.error(
      '\nDCO: this commit is missing a Signed-off-by trailer.\n\n' +
        'Sign off the most recent commit with:\n\n' +
        '  git commit --amend --signoff --no-edit\n\n' +
        'or pass `-s` to `git commit` next time. See CONTRIBUTING.md\n' +
        '(#developer-certificate-of-origin-dco) for the why.\n',
    );
    return 1;
  }
  if (result.reason === 'mismatched-signoff') {
    const lines = result.signoffs.map((s) => `  - ${s.name} <${s.email}>`).join('\n');
    console.error(
      '\nDCO: no Signed-off-by trailer matches the commit author.\n\n' +
        `Author:\n  ${result.author.name} <${result.author.email}>\n\n` +
        `Found Signed-off-by trailers:\n${lines}\n\n` +
        'Trailer name and email must match the author exactly. Fix with:\n\n' +
        '  git commit --amend --signoff --no-edit\n',
    );
    return 1;
  }
  console.error(`check-commit-signoff: ${result.reason}`);
  return 1;
}

if (import.meta.main) {
  process.exit(main(process.argv));
}

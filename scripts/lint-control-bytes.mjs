#!/usr/bin/env node
/**
 * Control characters live in source as escapes, never as raw bytes.
 *
 * `'\u0000'` and a literal NUL byte are the same string at runtime, so the
 * difference only ever shows up in the tooling around the code — which is
 * exactly where it hurts. Git reads a file holding a NUL as binary, so GitHub
 * renders no diff for it and `git blame -L`, `git log -S` and `grep` all skip
 * it. The rest of the control range is merely invisible: an editor shows
 * nothing, a reviewer reads a string that looks like it has no separator at
 * all, and printing the file to a terminal makes it beep.
 *
 * Tab, newline and carriage return are how text files are written and stay
 * allowed. Everything else in the C0 range, and DEL, is a mistake — usually a
 * paste that expanded an escape into the character it stands for.
 *
 * The fix is always the same: write the escape. If a file ever has to carry a
 * raw control byte, add the allowance here with the reason rather than
 * silencing the check.
 *
 * Exit codes:
 *   0 — no raw control byte
 *   1 — at least one, named by file, line and byte
 */

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const GIT_ROOT = process.cwd();

const SKIP_PATH = /(^|\/)(node_modules|dist|dist-tsc|dist-tsc-prod|coverage|\.turbo)\//;

/**
 * Formats whose bytes are not text at all. Content sniffing is not an option
 * here: a NUL byte is precisely what marks a file as binary, so detecting
 * binaries by content would skip the files this check exists to find.
 */
const BINARY = /\.(png|jpe?g|gif|ico|webp|woff2?|ttf|eot|pdf|zip|t?gz|wasm|mp4|node|snap)$/i;

/** Written as text and expected in text: tab, line feed, carriage return. */
const ALLOWED_BYTES = new Set([0x09, 0x0a, 0x0d]);

const isControl = (byte) => (byte < 0x20 || byte === 0x7f) && !ALLOWED_BYTES.has(byte);

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

/** Every raw control byte in `scanDir`, at most one per file. */
export function findViolations(scanDir, files = trackedFiles(scanDir)) {
  const violations = [];
  for (const relPath of files) {
    let content;
    try {
      content = readFileSync(join(scanDir, relPath));
    } catch {
      continue;
    }
    const at = content.findIndex(isControl);
    if (at === -1) continue;
    violations.push({
      file: relPath,
      line: content.subarray(0, at).toString('utf-8').split('\n').length,
      byte: `0x${content[at].toString(16).padStart(2, '0')}`,
    });
  }
  return violations;
}

export function main(scanDir = GIT_ROOT) {
  const violations = findViolations(scanDir);
  if (violations.length === 0) {
    console.log('No raw control byte in tracked source.');
    return 0;
  }

  console.error(`${violations.length} file(s) hold a raw control byte:\n`);
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}: ${violation.byte}`);
  }
  console.error(
    '\nWrite the character as an escape (`\\u0000`, `\\u0007`, …) instead. A raw\n' +
      'NUL makes git treat the file as binary, so GitHub shows no diff for it and\n' +
      'blame, log -S and grep skip it; the rest of the range is simply invisible\n' +
      'to whoever reads the code next.\n',
  );
  return 1;
}

if (process.argv[1] === import.meta.filename) process.exit(main());

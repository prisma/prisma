#!/usr/bin/env node
// One-off NOTICE audit (FR4 of the OSS-setup project).
//
// Apache-2.0 §4(d) requires us to propagate any NOTICE files from
// upstream Apache-2.0 dependencies whose code we redistribute. This
// script walks the installed dependency graph and reports every
// package that ships a NOTICE / NOTICE.txt file, together with its
// declared license, so the maintainer can decide:
//   * Which entries are *redistributed* (they live in the runtime
//     dependencies of a publishable workspace package and therefore
//     end up in a downstream consumer's install).
//   * Which entries are *dev-only* (devDependencies of any package, or
//     any dep of an example / integration-test workspace) and need not
//     be propagated under §4(d).
//
// The script is investigation-only — it does not mutate the repo or
// the registry. Its output is consumed by a human or by the audit
// summary at `projects/oss-setup/assets/notice-audit.md`.
//
// Usage:
//   node scripts/audit-notice.mjs               — human-readable text
//   node scripts/audit-notice.mjs --json        — machine-readable JSON
//   node scripts/audit-notice.mjs --apache-only — restrict to Apache-2.0 / MIT-with-NOTICE
//
// Requires `pnpm install` to have populated `node_modules/`.

import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PNPM_STORE = 'node_modules/.pnpm';
const NOTICE_FILENAMES = /^NOTICE(\.txt|\.md|\.markdown)?$/i;

/** Decode a pnpm-store directory name like `@scope+pkg@1.2.3_peer@4.5.6` into `(name, version)`. */
export function parsePnpmStoreEntry(entry) {
  // Strip the trailing peer-deps suffix (`_<peerspec>`) if present.
  const noPeer = entry.replace(/_.+$/, '');
  // Last `@` separates name from version (handles `@scope/name@version` because the scope `@` is the first char).
  const at = noPeer.lastIndexOf('@');
  if (at <= 0) return null;
  const namePart = noPeer.slice(0, at);
  const version = noPeer.slice(at + 1);
  // pnpm uses `+` to separate scope from name in the store directory name.
  const name = namePart.replace('+', '/');
  return { name, version };
}

/** Whether a package's declared license obliges us to propagate its NOTICE under §4(d) or analogous clauses. */
export function obligatesPropagation(license) {
  if (!license) return false;
  const norm = String(license).toUpperCase();
  // Apache-2.0 §4(d) is explicit. A NOTICE file accompanying a non-Apache
  // license is unusual but should be surfaced for human review (BSD-2/3
  // sometimes includes one as the attribution channel).
  return (
    norm === 'APACHE-2.0' || norm.includes('APACHE') || norm.startsWith('BSD-') || norm === 'BSD'
  );
}

function findNoticeFiles(packageDir) {
  if (!existsSync(packageDir)) return [];
  let entries;
  try {
    entries = readdirSync(packageDir);
  } catch {
    return [];
  }
  return entries.filter((f) => NOTICE_FILENAMES.test(f));
}

function safeReadJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function listPnpmStoreEntries() {
  if (!existsSync(PNPM_STORE)) return [];
  return readdirSync(PNPM_STORE).filter((d) => {
    try {
      return statSync(join(PNPM_STORE, d)).isDirectory();
    } catch {
      return false;
    }
  });
}

/** Returns the set of `name@version` strings reachable as production deps of any publishable workspace package. */
function collectRuntimeRedistributedSet() {
  // `pnpm list -r --prod --depth=Infinity --json` returns one entry per
  // workspace project with its full prod-dep tree. We then filter to
  // publishable workspace projects (private:false) and union all leaves.
  let raw;
  try {
    raw = execFileSync('pnpm', ['list', '-r', '--prod', '--depth=Infinity', '--json'], {
      encoding: 'utf-8',
      maxBuffer: 512 * 1024 * 1024,
    });
  } catch (err) {
    process.stderr.write(
      `warn: pnpm list failed (${err.message}); audit will mark all entries as runtime\n`,
    );
    return null;
  }
  let projects;
  try {
    projects = JSON.parse(raw);
  } catch {
    process.stderr.write(
      'warn: could not parse pnpm list output; audit will mark all entries as runtime\n',
    );
    return null;
  }
  const publishable = projects.filter((p) => p.private !== true);
  /** @type {Set<string>} */
  const seen = new Set();
  const visit = (deps) => {
    if (!deps || typeof deps !== 'object') return;
    for (const [name, info] of Object.entries(deps)) {
      if (!info || typeof info !== 'object') continue;
      const version = info.version;
      if (typeof version !== 'string') continue;
      if (info.path && /[\\/]packages[\\/]/.test(info.path)) continue;
      const key = `${name}@${version}`;
      if (seen.has(key)) continue;
      seen.add(key);
      visit(info.dependencies);
    }
  };
  for (const p of publishable) {
    visit(p.dependencies);
  }
  return seen;
}

const DEFAULT_IO = {
  listPnpmStoreEntries,
  readPackageJson: (dir) => safeReadJson(join(dir, 'package.json')),
  findNoticeFiles,
  readNotice: (path) => readFileSync(path, 'utf-8'),
  collectRuntimeRedistributedSet,
  stdoutWrite: (s) => process.stdout.write(s),
  stderrWrite: (s) => process.stderr.write(s),
};

/**
 * Runs the audit. Pure with respect to its `io` seam — the default
 * walks `node_modules/.pnpm/`, but tests can stub each leg.
 *
 * @param {object} [options]
 * @param {string[]} [options.argv]
 * @param {Partial<typeof DEFAULT_IO>} [options.io]
 * @returns {number}
 */
export function runAudit({ argv = process.argv.slice(2), io = {} } = {}) {
  const merged = { ...DEFAULT_IO, ...io };
  const args = new Set(argv);
  const json = args.has('--json');
  const apacheOnly = args.has('--apache-only');

  const entries = merged.listPnpmStoreEntries();
  const runtimeSet = merged.collectRuntimeRedistributedSet();

  /** @type {Array<{ name: string; version: string; license: unknown; runtime: boolean; notices: Array<{ filename: string; bytes: number; firstLine: string }> }>} */
  const findings = [];

  for (const entry of entries) {
    const parsed = parsePnpmStoreEntry(entry);
    if (!parsed) continue;
    const { name, version } = parsed;
    const installDir = join(PNPM_STORE, entry, 'node_modules', name);
    const noticeFiles = merged.findNoticeFiles(installDir);
    if (noticeFiles.length === 0) continue;
    const pkgJson = merged.readPackageJson(installDir);
    const license = pkgJson?.license ?? null;
    if (apacheOnly && !obligatesPropagation(license)) continue;
    const notices = noticeFiles.map((filename) => {
      const fullPath = join(installDir, filename);
      let body;
      try {
        body = merged.readNotice(fullPath);
      } catch {
        body = '';
      }
      const firstLine = body.split(/\r?\n/, 1)[0]?.trim() ?? '';
      return { filename, bytes: body.length, firstLine };
    });
    const runtime = runtimeSet === null ? true : runtimeSet.has(`${name}@${version}`);
    findings.push({ name, version, license, runtime, notices });
  }

  findings.sort((a, b) => a.name.localeCompare(b.name) || a.version.localeCompare(b.version));

  if (json) {
    merged.stdoutWrite(
      `${JSON.stringify(
        {
          totalScanned: entries.length,
          totalWithNotice: findings.length,
          runtimeWithNotice: findings.filter((f) => f.runtime).length,
          findings,
        },
        null,
        2,
      )}\n`,
    );
    return 0;
  }

  merged.stdoutWrite(
    `\nNOTICE audit — ${entries.length} packages scanned in ${PNPM_STORE}; ` +
      `${findings.length} ship a NOTICE file ` +
      `(${findings.filter((f) => f.runtime).length} reachable as runtime deps of a publishable workspace package).\n`,
  );

  if (findings.length === 0) {
    merged.stdoutWrite(
      '\nNo NOTICE files found in the installed dependency graph.\n' +
        'Apache-2.0 §4(d) is not engaged; no root NOTICE file is required for this release.\n',
    );
    return 0;
  }

  const groups = [
    { label: 'RUNTIME DEPS (propagation may be required by §4(d))', filter: (f) => f.runtime },
    {
      label: 'DEV / EXAMPLE / TEST DEPS (not redistributed; informational)',
      filter: (f) => !f.runtime,
    },
  ];
  for (const g of groups) {
    const subset = findings.filter(g.filter);
    if (subset.length === 0) continue;
    merged.stdoutWrite(`\n${g.label}\n${'-'.repeat(g.label.length)}\n`);
    for (const f of subset) {
      merged.stdoutWrite(`\n  ${f.name}@${f.version}  [license: ${JSON.stringify(f.license)}]\n`);
      for (const n of f.notices) {
        merged.stdoutWrite(`    ${n.filename}  (${n.bytes} bytes)  "${n.firstLine}"\n`);
      }
    }
  }

  merged.stdoutWrite(
    '\nNext steps:\n' +
      '  1. Review entries in RUNTIME DEPS. For each, decide whether §4(d) (or the analogous\n' +
      '     attribution clause for non-Apache licenses) obliges us to propagate the NOTICE.\n' +
      '  2. If yes for any entry: aggregate the notices into a root /NOTICE file and commit it.\n' +
      '  3. If no for all entries: record the basis in `projects/oss-setup/assets/notice-audit.md`.\n',
  );

  return 0;
}

export function main() {
  return runAudit();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  process.exit(main());
}

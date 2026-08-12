#!/usr/bin/env node
// Validates that every Markdown link in the architecture pattern catalogue
// resolves to a real file on disk. Exits non-zero on any unresolved internal
// link, listing each failure as `file:line  ->  target  (note)`.
//
// Walks the default target set:
//   - docs/architecture docs/patterns/**/*.md  (the catalogue itself)
//   - any extra files appended to EXTRA_TARGETS as catalogue-touching files
//     land in later milestones (architect persona, condensed reference docs,
//     adr-writing rule).
//
// Additional targets may be passed as CLI arguments (file paths or directories
// containing Markdown files).
//
// Internal links are repo-relative paths, optionally URL-encoded (handles the
// `%20` in `docs/architecture docs/adrs/ADR ...md` filenames). External links
// (https://, mailto:, tel:) and pure-anchor links (`#section`) are skipped.
//
// Usage:
//   node scripts/check-catalogue-links.mjs                  # default targets
//   node scripts/check-catalogue-links.mjs path/to/extra.md # add targets

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

const DEFAULT_DIR_TARGETS = ['docs/architecture docs/patterns'];

// Catalogue-touching files outside the patterns/ directory.
const EXTRA_TARGETS = [
  'docs/reference/typescript-patterns.md',
  '.agents/skills/drive-agent-personas/personas/architect.md',
  '.cursor/rules/adr-writing.mdc',
];

const MARKDOWN_EXTENSIONS = ['.md', '.mdc'];

const INLINE_LINK_RE = /(!?)\[([^\]]*)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;

/** Collect all Markdown files transitively under a given path. */
function collectMarkdownFiles(targetPath) {
  const abs = isAbsolute(targetPath) ? targetPath : join(REPO_ROOT, targetPath);
  if (!existsSync(abs)) return [];
  const stat = statSync(abs);
  if (stat.isFile()) {
    return MARKDOWN_EXTENSIONS.some((ext) => abs.endsWith(ext)) ? [abs] : [];
  }
  if (!stat.isDirectory()) return [];
  const out = [];
  for (const entry of readdirSync(abs)) {
    out.push(...collectMarkdownFiles(join(abs, entry)));
  }
  return out;
}

/** Yield every link in `content` as `{ rawTarget, line, image }`. */
function* extractLinks(content) {
  const lines = content.split(/\r?\n/);
  let inFence = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    INLINE_LINK_RE.lastIndex = 0;
    let match = INLINE_LINK_RE.exec(line);
    while (match !== null) {
      yield { image: match[1] === '!', rawTarget: match[3], line: i + 1 };
      match = INLINE_LINK_RE.exec(line);
    }
  }
}

/** Decide whether a link target is internal (resolved against disk). */
function isInternalLink(target) {
  if (!target) return false;
  if (target.startsWith('#')) return false;
  if (/^(?:[a-z][a-z0-9+.-]*:)/i.test(target)) return false;
  return true;
}

/** Resolve an internal link target to an absolute path on disk (or null if it
 *  cannot be normalized). Strips the fragment, decodes %xx escapes, and
 *  resolves relative to `fromFile`'s directory. */
function resolveTarget(rawTarget, fromFile) {
  const target = rawTarget.split('#')[0];
  if (!target) return null;
  let decoded;
  try {
    decoded = decodeURIComponent(target);
  } catch {
    return null;
  }
  if (decoded.startsWith('/')) {
    return join(REPO_ROOT, decoded.slice(1));
  }
  return resolve(dirname(fromFile), decoded);
}

function main() {
  const cliExtras = process.argv.slice(2);
  const targetSpecs = [...DEFAULT_DIR_TARGETS, ...EXTRA_TARGETS, ...cliExtras];

  const seen = new Set();
  const files = [];
  for (const spec of targetSpecs) {
    for (const f of collectMarkdownFiles(spec)) {
      if (!seen.has(f)) {
        seen.add(f);
        files.push(f);
      }
    }
  }

  if (files.length === 0) {
    console.error('check-catalogue-links: no Markdown files found in target set:');
    for (const t of targetSpecs) console.error(`  - ${t}`);
    process.exit(2);
  }

  const failures = [];
  let totalChecked = 0;
  for (const file of files) {
    const content = readFileSync(file, 'utf8');
    for (const { rawTarget, line, image } of extractLinks(content)) {
      if (!isInternalLink(rawTarget)) continue;
      totalChecked++;
      const resolved = resolveTarget(rawTarget, file);
      if (resolved === null || !existsSync(resolved)) {
        failures.push({
          file: relative(REPO_ROOT, file),
          line,
          target: rawTarget,
          note: image ? 'image' : 'link',
        });
      }
    }
  }

  if (failures.length > 0) {
    console.error(
      `check-catalogue-links: ${failures.length} unresolved link(s) across ${files.length} file(s):`,
    );
    for (const f of failures) {
      console.error(`  ${f.file}:${f.line}  ->  ${f.target}  (${f.note})`);
    }
    process.exit(1);
  }

  console.log(
    `check-catalogue-links: ${totalChecked} internal link(s) resolved across ${files.length} file(s).`,
  );
}

main();

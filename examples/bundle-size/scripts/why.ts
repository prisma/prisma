#!/usr/bin/env tsx
/**
 * Trace why a given input module ended up in a bundle.
 *
 * Usage:
 *   tsx scripts/why.ts <meta.json> <input-substring> [...more substrings]
 *
 * For each matching input, prints one or more shortest import paths from an
 * entry point to that input. Reads the esbuild metafile produced alongside
 * each bundle by scripts/bundle.ts.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Metafile } from 'esbuild';

const [, , metaArg, ...needles] = process.argv;
if (!metaArg || needles.length === 0) {
  console.error('usage: tsx scripts/why.ts <meta.json> <input-substring> [...]');
  process.exit(2);
}

const meta: Metafile = JSON.parse(await readFile(resolve(metaArg), 'utf8'));

// Build reverse graph: importee -> set of importers.
const reverse = new Map<string, Set<string>>();
for (const [importer, info] of Object.entries(meta.inputs)) {
  for (const imp of info.imports) {
    let importers = reverse.get(imp.path);
    if (!importers) {
      importers = new Set();
      reverse.set(imp.path, importers);
    }
    importers.add(importer);
  }
}

// Entry points are inputs that no one imports (in this metafile they're the
// `src/**/main*.ts` files).
const entryPoints = new Set<string>();
for (const path of Object.keys(meta.inputs)) {
  if (!reverse.has(path)) entryPoints.add(path);
}

function shortestPathToEntry(target: string): string[] | null {
  // BFS from target outward through reverse edges. The loop invariant
  // (queue.length > 0 && every pushed path is non-empty) guarantees
  // `queue.shift()` and `path[path.length - 1]` are defined; the explicit
  // guards below satisfy the linter without changing behaviour.
  const queue: string[][] = [[target]];
  const seen = new Set<string>([target]);
  while (queue.length > 0) {
    const path = queue.shift();
    if (path === undefined) continue;
    const head = path[path.length - 1];
    if (head === undefined) continue;
    if (entryPoints.has(head)) return path.slice().reverse();
    for (const importer of reverse.get(head) ?? []) {
      if (seen.has(importer)) continue;
      seen.add(importer);
      queue.push([...path, importer]);
    }
  }
  return null;
}

for (const needle of needles) {
  const matches = Object.keys(meta.inputs).filter((p) => p.includes(needle));
  if (matches.length === 0) {
    console.log(`\n# no input matches "${needle}"`);
    continue;
  }
  // Sort by descending bytes so the dominant copy is first.
  matches.sort((a, b) => (meta.inputs[b]?.bytes ?? 0) - (meta.inputs[a]?.bytes ?? 0));
  for (const match of matches) {
    const bytes = meta.inputs[match]?.bytes ?? 0;
    console.log(`\n# ${match}  (${(bytes / 1024).toFixed(1)} KiB)`);
    const path = shortestPathToEntry(match);
    if (!path) {
      console.log('  (no path to entry — orphan?)');
      continue;
    }
    for (let i = 0; i < path.length; i++) {
      console.log(`  ${'  '.repeat(i)}${path[i]}`);
    }
  }
}

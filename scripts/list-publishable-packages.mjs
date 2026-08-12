import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const SKIP_DIRS = new Set([
  'node_modules',
  'dist',
  'dist-tsc',
  'dist-tsc-prod',
  'coverage',
  '.tmp-output',
  '.turbo',
]);

const roots = [];
const seen = new Set();

/**
 * Recursively walk a directory and collect paths to non-private packages.
 * A package is considered publishable if it has a package.json without `"private": true`.
 */
function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (SKIP_DIRS.has(entry)) {
      continue;
    }

    const p = join(dir, entry);
    const st = statSync(p);

    if (st.isDirectory()) {
      walk(p);
      continue;
    }

    if (entry !== 'package.json') {
      continue;
    }

    const pkg = JSON.parse(readFileSync(p, 'utf8'));

    if (pkg?.private === true) {
      continue;
    }

    if (seen.has(dir)) {
      continue;
    }

    seen.add(dir);
    roots.push(`./${dir}`);
  }
}

walk('packages');
roots.sort((a, b) => a.localeCompare(b));
console.log(roots.join(' '));

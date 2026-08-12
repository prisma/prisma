#!/usr/bin/env node
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const RULES_DIR = '.agents/rules';

const REQUIRED = ['description', 'alwaysApply'];

const errors = [];

const files = readdirSync(RULES_DIR).filter((f) => !/^README\.md$/i.test(f));

for (const file of files) {
  if (!/\.(md|mdc)$/i.test(file)) continue;
  const full = join(RULES_DIR, file);
  const raw = readFileSync(full, 'utf8');
  const fmMatch = raw.match(/^---\s*\n([\s\S]*?)\n---/);
  if (!fmMatch) {
    errors.push(`${file}: missing frontmatter block`);
    continue;
  }
  const fm = parseFrontmatter(fmMatch[1]);

  // Validate required keys
  for (const key of REQUIRED) {
    if (!(key in fm)) errors.push(`${file}: missing required key '${key}'`);
  }

  // Validate types
  if (fm.description && typeof fm.description !== 'string')
    errors.push(`${file}: description must be string`);
  if (fm.alwaysApply !== undefined && typeof fm.alwaysApply !== 'boolean')
    errors.push(`${file}: alwaysApply must be boolean`);
  if (fm.globs !== undefined && !Array.isArray(fm.globs))
    errors.push(`${file}: globs must be array`);

  // Check for disallowed properties
  const allowedKeys = new Set(['description', 'globs', 'alwaysApply']);
  for (const key of Object.keys(fm)) {
    if (!allowedKeys.has(key)) {
      errors.push(
        `${file}: disallowed property '${key}' (allowed: description, globs, alwaysApply)`,
      );
    }
  }
}

if (errors.length) {
  console.error(`Rule validation failed:\n${errors.map((e) => ` - ${e}`).join('\n')}`);
  process.exit(1);
} else {
  console.log('All rules passed validation.');
}

function parseFrontmatter(src) {
  const obj = {};
  const lines = src.split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(/^([A-Za-z][A-Za-z0-9_-]*):\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    let val = m[2].trim();
    if (val === 'true') val = true;
    else if (val === 'false') val = false;
    else if (val === '') {
      // Empty value: for globs, treat as empty array; otherwise undefined
      if (key === 'globs') val = [];
      else val = undefined;
    } else if (val.startsWith('[') && val.endsWith(']')) {
      // simple array: ["a", "b"] or ['a','b'] or [a, b]
      const inner = val.slice(1, -1).trim();
      obj[key] = inner ? inner.split(',').map((s) => s.trim().replace(/^['"]|['"]$/g, '')) : [];
      continue;
    } else {
      val = val.replace(/^['"]|['"]$/g, '');
    }
    if (val !== undefined) {
      obj[key] = val;
    }
  }
  return obj;
}

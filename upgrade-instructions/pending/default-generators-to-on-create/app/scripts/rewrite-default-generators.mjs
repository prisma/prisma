#!/usr/bin/env node
// Rewrites `@default(uuid(...))`, `@default(cuid(...))`, `@default(ulid())` and `@default(nanoid(...))`
// to `@onCreate(...)` in the Prisma 8 schema files named on the command line.
import { readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';

const CLIENT_FUNCTION_IN_DEFAULT = /@default\(\s*((?:uuid|cuid|ulid|nanoid)\s*\([^()]*\))\s*\)/g;
const PRISMA7_BLOCK = /^\s*(?:datasource|generator)\s+\w+\s*\{/m;

const files = process.argv.slice(2);
if (files.length === 0) {
  process.stderr.write('Usage: node rewrite-default-generators.mjs <schema.prisma>...\n');
  process.exit(1);
}

const texts = new Map();
for (const file of files) {
  try {
    texts.set(file, readFileSync(file, 'utf8'));
  } catch {
    process.stderr.write(`${file}: cannot be read; no file was changed.\n`);
    process.exit(1);
  }
}

for (const [file, text] of texts) {
  if (PRISMA7_BLOCK.test(text)) {
    process.stdout.write(
      `${file}: a Prisma 7 schema (it has a datasource or generator block); left unchanged. A Prisma 7 schema keeps @default(uuid()).\n`,
    );
    continue;
  }
  let count = 0;
  const rewritten = text.replace(CLIENT_FUNCTION_IN_DEFAULT, (_match, call) => {
    count += 1;
    return `@onCreate(${call})`;
  });
  if (count === 0) {
    process.stdout.write(`${file}: no client function in @default; left unchanged.\n`);
    continue;
  }
  writeFileSync(file, rewritten);
  process.stdout.write(`${file}: rewrote ${count} @default calls to @onCreate.\n`);
}

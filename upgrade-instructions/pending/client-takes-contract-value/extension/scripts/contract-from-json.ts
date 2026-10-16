// Moves every Prisma 8 client call that passes `contractJson` to a contract value:
//   postgres<Contract>({ contractJson, url })
// becomes
//   export const contract = contractFromJson<Contract>(contractJson);
//   postgres({ contract, url })
//
// Usage: node contract-from-json.ts [project root]
// Rewrites source files in place, and leaves test files (under a test, tests or __tests__ directory,
// or named *.test.* or *.spec.*) for you to move. Prints each file it rewrote, and each file it could
// not move to stderr with the reason; exits 1 when there is such a file.

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const SOURCE_FILE = /\.(?:ts|tsx|mts|cts)$/;
const SKIPPED_DIRECTORIES = new Set([
  'node_modules',
  'dist',
  'build',
  '.git',
  '.next',
  '.turbo',
  'test',
  'tests',
  '__tests__',
]);
const TEST_FILE = /\.(?:test|spec)(?:-d)?\.[cm]?tsx?$/;

const FACADE_ENTRY =
  /^@prisma\/orm-(postgres|sqlite|mongo)\/(?:runtime|serverless|static|query-builder)$/;
const SUPABASE_ENTRY = '@prisma/orm-extension-supabase/runtime';

interface Factory {
  readonly name: string;
  readonly staticEntry: string;
}

interface Call {
  readonly start: number;
  readonly end: number;
  readonly replacement: string;
  readonly typeArgument: string | undefined;
  readonly json: string;
  readonly staticEntry: string;
}

interface ImportStatement {
  readonly start: number;
  readonly end: number;
  readonly text: string;
  readonly specifier: string;
}

function importStatements(source: string): ImportStatement[] {
  const statements: ImportStatement[] = [];
  const pattern = /^import\s[^;]*?from\s+'([^']+)'[^;\n]*;[ \t]*\n|^import\s+'([^']+)';[ \t]*\n/gm;
  for (const match of source.matchAll(pattern)) {
    statements.push({
      start: match.index,
      end: match.index + match[0].length,
      text: match[0],
      specifier: match[1] ?? match[2] ?? '',
    });
  }
  return statements;
}

function factoriesOf(imports: readonly ImportStatement[]): Factory[] {
  const factories: Factory[] = [];
  for (const statement of imports) {
    if (statement.text.startsWith('import type')) continue;
    const facade = FACADE_ENTRY.exec(statement.specifier);
    const staticEntry = facade
      ? `@prisma/orm-${facade[1]}/static`
      : statement.specifier === SUPABASE_ENTRY
        ? '@prisma/orm-postgres/static'
        : undefined;
    if (staticEntry === undefined) continue;
    const clause = /^import\s+([\s\S]*?)\s+from\s/.exec(statement.text)?.[1] ?? '';
    const defaultName = /^([A-Za-z_$][\w$]*)/.exec(clause)?.[1];
    if (defaultName !== undefined && defaultName !== 'type') {
      factories.push({ name: defaultName, staticEntry });
    }
    const named = /\{([^}]*)\}/.exec(clause)?.[1] ?? '';
    for (const part of named.split(',')) {
      const binding = /^\s*(?:type\s+)?([\w$]+)(?:\s+as\s+([\w$]+))?\s*$/.exec(part);
      if (binding === null || /^\s*type\s/.test(part)) continue;
      const imported = binding[1] ?? '';
      const local = binding[2] ?? imported;
      if (imported === 'supabase' || imported === 'mongoQuery') {
        factories.push({ name: local, staticEntry });
      }
    }
  }
  return factories;
}

function matchingBrace(source: string, open: number): number {
  let depth = 0;
  for (let index = open; index < source.length; index++) {
    const char = source[index];
    if (char === "'" || char === '"' || char === '`') {
      index = source.indexOf(char, index + 1);
      if (index === -1) return -1;
      continue;
    }
    if (char === '{' || char === '(' || char === '[') depth++;
    if (char === '}' || char === ')' || char === ']') {
      depth--;
      if (depth === 0) return index;
    }
  }
  return -1;
}

function callsOf(source: string, factory: Factory): Call[] {
  const calls: Call[] = [];
  const pattern = new RegExp(
    `(?<![\\w$.])${factory.name.replace(/\$/g, '\\$')}(<[^>()]*(?:<[^>()]*>[^>()]*)*>)?\\(\\s*\\{`,
    'g',
  );
  for (const match of source.matchAll(pattern)) {
    const open = match.index + match[0].length - 1;
    const close = matchingBrace(source, open);
    if (close === -1) continue;
    const body = source.slice(open, close + 1);
    const property = /([{,]\s*)contractJson(\s*:\s*([^,}\n]+?))?(\s*[,}\n])/.exec(body);
    if (property === null) continue;
    const json = (property[3] ?? 'contractJson').trim();
    const newBody =
      body.slice(0, property.index) +
      `${property[1]}contract${property[4]}` +
      body.slice(property.index + property[0].length);
    calls.push({
      start: match.index,
      end: close + 1,
      replacement: `${factory.name}(${match[0].slice(match[0].indexOf('(') + 1, -1)}${newBody}`,
      typeArgument: match[1]?.slice(1, -1),
      json,
      staticEntry: factory.staticEntry,
    });
  }
  return calls;
}

function compareSpecifiers(left: string, right: string): number {
  const rank = (specifier: string) =>
    specifier.startsWith('node:') ? 0 : specifier.startsWith('.') ? 2 : 1;
  return rank(left) - rank(right) || (left < right ? -1 : left > right ? 1 : 0);
}

function withStaticImport(source: string, staticEntry: string): string {
  const imports = importStatements(source);
  const existing = imports.find(
    (statement) => statement.specifier === staticEntry && !statement.text.startsWith('import type'),
  );
  if (existing !== undefined) {
    if (/\bcontractFromJson\b/.test(existing.text)) return source;
    const merged = existing.text.includes('{')
      ? existing.text.replace(/\{\s*/, '{ contractFromJson, ')
      : existing.text.replace(/^import\s+([\w$]+)\s+from/, 'import $1, { contractFromJson } from');
    return source.slice(0, existing.start) + merged + source.slice(existing.end);
  }
  const line = `import { contractFromJson } from '${staticEntry}';\n`;
  const after = imports.find(
    (statement) =>
      statement.specifier !== 'dotenv/config' &&
      compareSpecifiers(statement.specifier, staticEntry) > 0,
  );
  const at = after?.start ?? imports.at(-1)?.end ?? 0;
  return source.slice(0, at) + line + source.slice(at);
}

function declaresContract(source: string): boolean {
  return (
    /(?:^|[\s;])(?:const|let|var|function|class)\s+contract\b/.test(source) ||
    /import[^;]*[{,\s]contract\s*[,}][^;]*from/.test(source)
  );
}

type Outcome =
  | { readonly kind: 'unchanged' }
  | { readonly kind: 'rewritten'; readonly source: string }
  | { readonly kind: 'refused'; readonly reason: string };

export function moveFile(source: string): Outcome {
  const factories = factoriesOf(importStatements(source));
  const calls = factories.flatMap((factory) => callsOf(source, factory));
  if (calls.length === 0) return { kind: 'unchanged' };
  const first = calls[0];
  if (first === undefined) return { kind: 'unchanged' };
  const differing = calls.find(
    (call) =>
      call.json !== first.json ||
      call.typeArgument !== first.typeArgument ||
      call.staticEntry !== first.staticEntry,
  );
  if (differing !== undefined) {
    return {
      kind: 'refused',
      reason: 'its clients use different contracts; give each its own contractFromJson value',
    };
  }
  if (declaresContract(source)) {
    return {
      kind: 'refused',
      reason: 'it already declares a binding named contract; choose another name for the value',
    };
  }

  let moved = source;
  for (const call of [...calls].sort((left, right) => right.start - left.start)) {
    moved = moved.slice(0, call.start) + call.replacement + moved.slice(call.end);
  }
  moved = withStaticImport(moved, first.staticEntry);

  const exported = /^export\s+default\b/m.test(moved) ? '' : 'export ';
  const typeArgument = first.typeArgument === undefined ? '' : `<${first.typeArgument}>`;
  const declaration = `${exported}const contract = contractFromJson${typeArgument}(${first.json});\n`;
  const lastImport = importStatements(moved).at(-1);
  const at = lastImport?.end ?? 0;
  const rest = moved.slice(at).replace(/^\n*/, '');
  moved = `${moved.slice(0, at)}\n${declaration}\n${rest}`;
  return { kind: 'rewritten', source: moved };
}

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory)) {
    if (SKIPPED_DIRECTORIES.has(entry)) continue;
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) files.push(...sourceFiles(path));
    else if (SOURCE_FILE.test(entry) && !entry.endsWith('.d.ts') && !TEST_FILE.test(entry)) {
      files.push(path);
    }
  }
  return files;
}

function main(): number {
  const root = process.argv[2] ?? process.cwd();
  let refused = 0;
  for (const path of sourceFiles(root).sort()) {
    const outcome = moveFile(readFileSync(path, 'utf8'));
    if (outcome.kind === 'rewritten') {
      writeFileSync(path, outcome.source);
      process.stdout.write(`${relative(root, path)}: moved to contractFromJson\n`);
    } else if (outcome.kind === 'refused') {
      refused++;
      process.stderr.write(`${relative(root, path)}: not moved, because ${outcome.reason}\n`);
    }
  }
  return refused === 0 ? 0 : 1;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exitCode = main();
}

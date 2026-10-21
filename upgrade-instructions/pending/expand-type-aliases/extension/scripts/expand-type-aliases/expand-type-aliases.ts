#!/usr/bin/env node
/**
 * Writes every type alias a column of a SQL contract is typed by into the column. Contracts emitted before this release store an alias as a `storage.types` entry and each column typed by it as a `typeRef` naming the entry; this release stores the alias's params on the column itself and refuses a stored `typeRef`. In each contract the script replaces every column's `typeRef` with the entry's `typeParams`, removes each entry a column named, and makes the same change in `contract.d.ts`. An entry no column names is kept and listed, because it may be a database type an extension registers. The script then renames the snapshot directories and rewrites every migration, ref, `migration.ts` and `contract.d.ts` that names an old storage hash.
 *
 * Usage: node expand-type-aliases.ts [project-root]
 *
 * The project root defaults to the working directory. The script reads and writes files only. It needs no database, network or configured stack, and a project with no `typeRef` is left unchanged. When it stops (a file it must read is not valid JSON, a contract whose stored hash does not match its content, a column whose alias is missing or has another codec or data type, or a snapshot directory that already exists with different content) it changes no file, prints one line per case and exits 1. When it finishes it prints how many files and snapshot directories it changed, each storage hash it replaced and each entry it kept.
 *
 * The storage hash and migration hash rules are copied from `@internal/contract` and `@internal/migration-tools` because a project's strict `node_modules` does not expose them.
 */
import { createHash } from 'node:crypto';
import {
  chmodSync,
  type Dirent,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';

type Json = null | boolean | number | string | Json[] | JsonRecord;
interface JsonRecord {
  [key: string]: Json;
}

const SKIPPED_DIRECTORIES = new Set(['node_modules', '.git', 'dist', 'build']);
const HASH = /^[0-9a-f]{64}$/;
const TEMPORARY_SUFFIX = '.expand-type-aliases-tmp';

function isRecord(value: unknown): value is JsonRecord {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const prototype: unknown = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function parseJson(text: string): Json | undefined {
  try {
    const value: Json = JSON.parse(text);
    return value;
  } catch {
    return undefined;
  }
}

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

function compareCodeUnits(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

function sortKeys(value: Json): Json {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  const sorted: JsonRecord = {};
  for (const key of Object.keys(value).sort(compareCodeUnits)) {
    const child = value[key];
    if (child !== undefined) sorted[key] = sortKeys(child);
  }
  return sorted;
}

function canonicalizeJson(value: Json): string {
  return JSON.stringify(sortKeys(value));
}

type PathSegment = string | readonly string[];

function matchesPath(path: readonly string[], pattern: readonly PathSegment[]): boolean {
  if (path.length !== pattern.length) return false;
  return pattern.every((segment, index) => {
    const value = path[index];
    if (value === undefined) return false;
    if (segment === '*') return true;
    return typeof segment === 'string' ? value === segment : segment.includes(value);
  });
}

const SQL_PRESERVED_EMPTY: readonly (readonly PathSegment[])[] = [
  ['storage', 'namespaces', '*', 'entries', 'table'],
  ['storage', 'namespaces', '*', 'entries', 'table', '*'],
  ['storage', 'namespaces', '*', 'entries', 'table', '*', ['uniques', 'indexes', 'foreignKeys']],
  ['storage', 'namespaces', '*', 'entries', 'table', '*', 'indexes', 'unique'],
  ['storage', 'namespaces', '*', 'entries', 'table', '*', 'columns', '*', 'default', 'value'],
];
const COLUMN_DEFAULT_VALUE: readonly PathSegment[] = [
  'storage',
  'namespaces',
  '*',
  'entries',
  'table',
  '*',
  'columns',
  '*',
  'default',
  'value',
];
const FRAMEWORK_PRESERVED_EMPTY: readonly (readonly PathSegment[])[] = [
  ['domain', 'namespaces'],
  ['domain', 'namespaces', '*'],
  ['domain', 'namespaces', '*', 'models'],
  ['domain', 'namespaces', '*', 'models', '*', 'relations'],
  ['domain', 'namespaces', '*', 'models', '*', 'storage'],
  ['storage', 'namespaces'],
  ['storage', 'namespaces', '*', 'entries'],
  ['roots'],
  ['extensions'],
  ['extensions', '*'],
  ['capabilities'],
  ['meta'],
  ['execution', 'mutations', 'defaults'],
];
const TOP_LEVEL_ORDER = [
  'schemaVersion',
  'canonicalVersion',
  'targetFamily',
  'target',
  'profileHash',
  'roots',
  'domain',
  'storage',
  'execution',
  'capabilities',
  'extensions',
  'defaultControlPolicy',
  'meta',
];

function isDefaultValue(value: Json): boolean {
  if (value === false) return true;
  if (Array.isArray(value)) return value.length === 0;
  return isRecord(value) && Object.keys(value).length === 0;
}

function isPreservedEmpty(path: readonly string[], key: string): boolean {
  if (key === 'nullable') return true;
  if (key === 'elementNullable' && path.at(-2) === 'many') return true;
  if (FRAMEWORK_PRESERVED_EMPTY.some((pattern) => matchesPath(path, pattern))) return true;
  if (
    path.length >= COLUMN_DEFAULT_VALUE.length &&
    matchesPath(path.slice(0, COLUMN_DEFAULT_VALUE.length), COLUMN_DEFAULT_VALUE)
  )
    return true;
  return SQL_PRESERVED_EMPTY.some((pattern) => matchesPath(path, pattern));
}

function omitDefaults(value: Json, path: readonly string[]): Json {
  if (Array.isArray(value)) return value.map((item) => omitDefaults(item, path));
  if (!isRecord(value)) return value;
  const result: JsonRecord = {};
  for (const [key, child] of Object.entries(value)) {
    const childPath = [...path, key];
    if (key === '_generated') continue;
    if (key === 'generated' && child === false) continue;
    if ((key === 'onDelete' || key === 'onUpdate') && child === 'noAction') continue;
    if (isDefaultValue(child) && !isPreservedEmpty(childPath, key)) continue;
    result[key] = omitDefaults(child, childPath);
  }
  return result;
}

function compareByName(a: Json, b: Json): number {
  const nameA = isRecord(a) && typeof a['name'] === 'string' ? a['name'] : '';
  const nameB = isRecord(b) && typeof b['name'] === 'string' ? b['name'] : '';
  return compareCodeUnits(nameA, nameB);
}

function sortTableArrays(storage: Json): Json {
  if (!isRecord(storage)) return storage;
  const namespaces = storage['namespaces'];
  if (!isRecord(namespaces)) return storage;
  const sortedNamespaces: JsonRecord = {};
  for (const [namespaceId, namespace] of Object.entries(namespaces)) {
    const entries = isRecord(namespace) ? namespace['entries'] : undefined;
    const tables = isRecord(entries) ? entries['table'] : undefined;
    if (!isRecord(namespace) || !isRecord(entries) || !isRecord(tables)) {
      sortedNamespaces[namespaceId] = namespace;
      continue;
    }
    const sortedTables: JsonRecord = {};
    for (const [tableName, table] of Object.entries(tables)) {
      if (!isRecord(table)) {
        sortedTables[tableName] = table;
        continue;
      }
      const sortedTable: JsonRecord = { ...table };
      for (const key of ['checks', 'indexes', 'uniques']) {
        const list = table[key];
        if (Array.isArray(list)) sortedTable[key] = [...list].sort(compareByName);
      }
      sortedTables[tableName] = sortedTable;
    }
    sortedNamespaces[namespaceId] = { ...namespace, entries: { ...entries, table: sortedTables } };
  }
  return { ...storage, namespaces: sortedNamespaces };
}

function orderTopLevel(value: JsonRecord): JsonRecord {
  const ordered: JsonRecord = {};
  const remaining = new Set(Object.keys(value));
  for (const key of TOP_LEVEL_ORDER) {
    const child = value[key];
    if (child !== undefined) {
      ordered[key] = child;
      remaining.delete(key);
    }
  }
  for (const key of [...remaining].sort(compareCodeUnits)) {
    const child = value[key];
    if (child !== undefined) ordered[key] = child;
  }
  return ordered;
}

function omitNamespaceKinds(storage: JsonRecord): JsonRecord {
  const namespaces = storage['namespaces'];
  if (!isRecord(namespaces)) return storage;
  const stripped: JsonRecord = {};
  for (const [namespaceId, namespace] of Object.entries(namespaces)) {
    if (isRecord(namespace)) {
      const { kind: _kind, ...rest } = namespace;
      stripped[namespaceId] = rest;
    } else {
      stripped[namespaceId] = namespace;
    }
  }
  return { ...storage, namespaces: stripped };
}

function computeStorageHash(contract: JsonRecord): string {
  const storage = isRecord(contract['storage']) ? contract['storage'] : {};
  const { storageHash: _published, ...withoutHash } = storage;
  const hashed: JsonRecord = {
    schemaVersion: '1',
    targetFamily: typeof contract['targetFamily'] === 'string' ? contract['targetFamily'] : '',
    target: typeof contract['target'] === 'string' ? contract['target'] : '',
    profileHash: '',
    roots: {},
    domain: { namespaces: {} },
    storage: omitNamespaceKinds(withoutHash),
    extensions: {},
    capabilities: {},
    meta: {},
  };
  const withoutDefaults = omitDefaults(hashed, []);
  if (!isRecord(withoutDefaults)) return '';
  const withSortedStorage = {
    ...withoutDefaults,
    storage: sortTableArrays(withoutDefaults['storage'] ?? {}),
  };
  const sorted = sortKeys(withSortedStorage);
  return isRecord(sorted) ? sha256(JSON.stringify(orderTopLevel(sorted), null, 2)) : '';
}

function computeMigrationHash(metadata: JsonRecord, ops: Json): string {
  const { migrationHash: _migrationHash, ...withoutHash } = metadata;
  const parts = [canonicalizeJson(withoutHash), canonicalizeJson(ops)].map(sha256);
  return sha256(canonicalizeJson(parts));
}

interface ProjectFiles {
  readonly json: readonly string[];
  readonly migrationJson: readonly string[];
  readonly refs: readonly string[];
  readonly migrationTs: readonly string[];
  readonly leftovers: readonly string[];
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

/** A file, or a link to one: the script reads and writes through links to files. */
function isFileEntry(dir: string, entry: Dirent): boolean {
  return entry.isFile() || (entry.isSymbolicLink() && isFile(join(dir, entry.name)));
}

/** A file the script reads, by the path it was reached through: its own path rather than a link's. */
interface FoundFile {
  readonly path: string;
  readonly linked: boolean;
  readonly inMigrationPackage: boolean;
}

function listFiles(root: string): ProjectFiles {
  const leftovers: string[] = [];
  const visited = new Set<string>();
  const found = new Map<string, FoundFile>();
  const visit = (dir: string): void => {
    const realDir = realpathSync(dir);
    if (visited.has(realDir)) return;
    visited.add(realDir);
    const entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) =>
      compareCodeUnits(a.name, b.name),
    );
    const inMigrationPackage = entries.some(
      (entry) => entry.name === 'migration.json' && isFileEntry(dir, entry),
    );
    for (const entry of entries) {
      const path = join(dir, entry.name);
      if (entry.name.endsWith(TEMPORARY_SUFFIX)) {
        leftovers.push(path);
        continue;
      }
      if (entry.isDirectory() || (entry.isSymbolicLink() && isDirectory(path))) {
        if (!SKIPPED_DIRECTORIES.has(entry.name)) visit(path);
        continue;
      }
      if (!isFileEntry(dir, entry)) continue;
      const realFile = realpathSync(path);
      const linked = entry.isSymbolicLink();
      const known = found.get(realFile);
      if (known === undefined || (known.linked && !linked))
        found.set(realFile, { path, linked, inMigrationPackage });
    }
  };
  visit(root);
  const files = [...found.values()];
  const named = (test: (file: FoundFile, name: string) => boolean): string[] =>
    files.filter((file) => test(file, basename(file.path))).map((file) => file.path);
  return {
    json: named((_file, name) => name.endsWith('.json')),
    migrationJson: named((_file, name) => name === 'migration.json'),
    refs: named((file, name) => name.endsWith('.json') && basename(dirname(file.path)) === 'refs'),
    migrationTs: named((file, name) => name === 'migration.ts' && file.inMigrationPackage),
    leftovers,
  };
}

function isSnapshotContract(path: string): boolean {
  const snapshotDir = dirname(path);
  return (
    basename(path) === 'contract.json' &&
    HASH.test(basename(snapshotDir)) &&
    basename(dirname(snapshotDir)) === 'snapshots'
  );
}

function replaceQuotedHashes(text: string, hashes: ReadonlyMap<string, string>): string {
  return text.replace(/"([0-9a-f]{64})"/g, (match: string, hash: string) => {
    const next = hashes.get(hash);
    return next === undefined ? match : `"${next}"`;
  });
}

function readDirectory(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir, { withFileTypes: true }))
    if (isFileEntry(dir, entry) && !entry.name.endsWith(TEMPORARY_SUFFIX))
      files.set(entry.name, readFileSync(join(dir, entry.name), 'utf8'));
  return files;
}

function sameFiles(a: ReadonlyMap<string, string>, b: ReadonlyMap<string, string>): boolean {
  return a.size === b.size && [...a].every(([name, content]) => b.get(name) === content);
}

function temporaryPath(path: string): string {
  return join(dirname(path), `.${basename(path)}${TEMPORARY_SUFFIX}`);
}

function writeWithModeOf(path: string, text: string, modeSource: string): void {
  writeFileSync(path, text);
  if (existsSync(modeSource)) chmodSync(path, statSync(modeSource).mode & 0o7777);
}

function writeFile(path: string, text: string): void {
  const target = realpathSync(path);
  const temporary = temporaryPath(target);
  writeWithModeOf(temporary, text, target);
  renameSync(temporary, target);
}

function writeDirectory(dir: string, files: ReadonlyMap<string, string>, sourceDir: string): void {
  const temporary = temporaryPath(dir);
  mkdirSync(temporary);
  for (const [name, text] of files)
    writeWithModeOf(join(temporary, name), text, join(sourceDir, name));
  renameSync(temporary, dir);
}

function removeDirectory(dir: string): void {
  const temporary = temporaryPath(dir);
  renameSync(dir, temporary);
  rmSync(temporary, { recursive: true, force: true });
}

function count(amount: number, singular: string, plural: string): string {
  return `${amount} ${amount === 1 ? singular : plural}`;
}

const REMOVED_KEY = 'typeRef';
const DTS_LINE_WIDTH = 100;

interface Rewrite {
  readonly contract: JsonRecord;
  readonly changed: boolean;
  /** The `storage.types` entries a column referenced, which the rewrite removed. */
  readonly expanded: ReadonlyMap<string, JsonRecord>;
  /** The `storage.types` entries no column referenced, which the rewrite kept. */
  readonly kept: readonly string[];
  readonly problems: readonly string[];
}

function nonEmptyParams(entry: JsonRecord): JsonRecord | undefined {
  const params = entry['typeParams'];
  return isRecord(params) && Object.keys(params).length > 0 ? params : undefined;
}

/** The column with its `typeRef` replaced, in place, by the referenced entry's params. */
function expandedColumn(column: JsonRecord, entry: JsonRecord): JsonRecord {
  const params = nonEmptyParams(entry);
  const result: JsonRecord = {};
  for (const [key, value] of Object.entries(column)) {
    if (key !== REMOVED_KEY) result[key] = value;
    else if (params !== undefined) result['typeParams'] = params;
  }
  return result;
}

function describeType(record: JsonRecord): string {
  return `codec ${String(record['codecId'])} and data type ${String(record['dataType'])}`;
}

/** The contract with every column's type alias written into the column, and the aliases it named removed from `storage.types`. */
function rewriteContract(contract: JsonRecord): Rewrite {
  const copy = parseJson(JSON.stringify(contract));
  const storage = isRecord(copy) ? copy['storage'] : undefined;
  if (!isRecord(copy) || !isRecord(storage))
    return { contract, changed: false, expanded: new Map(), kept: [], problems: [] };
  const types = isRecord(storage['types']) ? storage['types'] : {};
  const expanded = new Map<string, JsonRecord>();
  const problems: string[] = [];
  let changed = false;
  const namespaces = storage['namespaces'];
  for (const namespace of isRecord(namespaces) ? Object.values(namespaces) : []) {
    const entries = isRecord(namespace) ? namespace['entries'] : undefined;
    const tables = isRecord(entries) ? entries['table'] : undefined;
    for (const [tableName, table] of isRecord(tables) ? Object.entries(tables) : []) {
      const columns = isRecord(table) ? table['columns'] : undefined;
      if (!isRecord(columns)) continue;
      for (const [columnName, column] of Object.entries(columns)) {
        if (!isRecord(column) || !Object.hasOwn(column, REMOVED_KEY)) continue;
        changed = true;
        const alias = column[REMOVED_KEY];
        const entry = typeof alias === 'string' ? types[alias] : undefined;
        const where = `column ${tableName}.${columnName}`;
        if (typeof alias !== 'string' || !isRecord(entry)) {
          problems.push(
            `${where} is typed by the type alias ${JSON.stringify(alias)}, which storage.types does not declare`,
          );
          continue;
        }
        if (Object.hasOwn(column, 'typeParams')) {
          problems.push(`${where} stores both typeRef and typeParams`);
          continue;
        }
        if (column['codecId'] !== entry['codecId'] || column['dataType'] !== entry['dataType']) {
          problems.push(
            `${where} has ${describeType(column)}, but its type alias ${alias} has ${describeType(entry)}`,
          );
          continue;
        }
        columns[columnName] = expandedColumn(column, entry);
        expanded.set(alias, entry);
      }
    }
  }
  for (const alias of expanded.keys()) delete types[alias];
  if (expanded.size > 0 && Object.keys(types).length === 0) delete storage['types'];
  const kept = Object.keys(types).sort(compareCodeUnits);
  return { contract: copy, changed, expanded, kept, problems };
}

function withStorageHash(contract: JsonRecord, hash: string): JsonRecord {
  const storage = contract['storage'];
  if (!isRecord(storage) || typeof storage['storageHash'] !== 'string') return contract;
  return { ...contract, storage: { ...storage, storageHash: hash } };
}

/** The contract written the way the file held it: a snapshot's canonical line, or indented JSON. */
function writtenForm(contract: JsonRecord, original: JsonRecord, text: string): string {
  const newline = text.endsWith('\n') ? '\n' : '';
  if (text === `${canonicalizeJson(original)}${newline}`)
    return `${canonicalizeJson(contract)}${newline}`;
  return `${JSON.stringify(contract, null, 2)}${newline}`;
}

interface Block {
  readonly start: number;
  end: number;
  readonly label: string;
  readonly parent: Block | undefined;
}

function scanBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const open: Block[] = [];
  let quote: string | undefined;
  for (let index = 0; index < text.length; index++) {
    const char = text[index];
    if (quote !== undefined) {
      if (char === '\\') index++;
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') {
      const key =
        /(?:readonly\s+)?([\p{ID_Start}_$][\p{ID_Continue}$]*|'[^']*'|"[^"]*")\s*\??\s*:\s*$/u.exec(
          text.slice(Math.max(0, index - 200), index),
        );
      const block: Block = {
        start: index,
        end: text.length,
        label: key?.[1]?.replace(/^['"]|['"]$/g, '') ?? '',
        parent: open.at(-1),
      };
      open.push(block);
      blocks.push(block);
    } else if (char === '}') {
      const block = open.pop();
      if (block !== undefined) block.end = index;
    }
  }
  return blocks;
}

function innermostBlock(blocks: readonly Block[], position: number): Block | undefined {
  let found: Block | undefined;
  for (const block of blocks)
    if (
      block.start < position &&
      position < block.end &&
      (found === undefined || block.start > found.start)
    )
      found = block;
  return found;
}

/** Whether the block is a storage column (`namespaces.<ns>.entries.table.<table>.columns.<column>`). */
function isColumnBlock(block: Block): boolean {
  const table = block.parent?.parent;
  return (
    block.parent?.label === 'columns' &&
    table?.parent?.label === 'table' &&
    table.parent.parent?.label === 'entries'
  );
}

function childBlocks(blocks: readonly Block[], parent: Block): Block[] {
  return blocks.filter((block) => block.parent === parent);
}

/** The `readonly types` block of the storage type: the one whose parent also holds `namespaces`. */
function storageTypesBlock(blocks: readonly Block[]): Block | undefined {
  return blocks.find(
    (block) =>
      block.label === 'types' &&
      block.parent !== undefined &&
      childBlocks(blocks, block.parent).some((sibling) => sibling.label === 'namespaces'),
  );
}

function lineStart(text: string, position: number): number {
  return text.lastIndexOf('\n', position - 1) + 1;
}

/** The end of the member a block closes: past its `;` and the line break after it. */
function memberEnd(text: string, block: Block): number {
  const rest = /^\s*;?[ \t]*\n?/.exec(text.slice(block.end + 1));
  return block.end + 1 + (rest?.[0].length ?? 0);
}

function indentOf(text: string, position: number): string {
  return /^[ \t]*/.exec(text.slice(lineStart(text, position)))?.[0] ?? '';
}

/** Splits `{ a; b }` into its top-level members. */
function topLevelMembers(literal: string): string[] {
  const inner = literal.trim().slice(1, -1);
  const members: string[] = [];
  let depth = 0;
  let quote: string | undefined;
  let current = '';
  for (let index = 0; index < inner.length; index++) {
    const char = inner[index] ?? '';
    current += char;
    if (quote !== undefined) {
      if (char === '\\') current += inner[++index] ?? '';
      else if (char === quote) quote = undefined;
      continue;
    }
    if (char === "'" || char === '"' || char === '`') quote = char;
    else if (char === '{' || char === '[' || char === '(') depth++;
    else if (char === '}' || char === ']' || char === ')') depth--;
    else if (char === ';' && depth === 0) {
      members.push(current.slice(0, -1).trim());
      current = '';
    }
  }
  if (current.trim() !== '') members.push(current.trim());
  return members;
}

/** The `readonly typeParams` member, laid out as the emitter's formatter lays it out at `indent`. */
function typeParamsMember(literal: string, indent: string): string {
  const lines = literal.split('\n');
  const head = `${indent}readonly typeParams: `;
  if (lines.length > 1) {
    const literalIndent = /^[ \t]*/.exec(lines.at(-1) ?? '')?.[0] ?? '';
    const shifted = lines.map((line, index) =>
      index === 0 ? line : `${indent}${line.slice(literalIndent.length)}`,
    );
    return `${head}${shifted.join('\n')};`;
  }
  const single = `${head}${literal};`;
  if (single.length <= DTS_LINE_WIDTH) return single;
  const members = topLevelMembers(literal).map((member) => `${indent}  ${member};`);
  return `${head}{\n${members.join('\n')}\n${indent}};`;
}

/** The text of `typeParams` in an entry block of `readonly types`, as the emitter wrote it. */
function entryParamsLiteral(
  text: string,
  blocks: readonly Block[],
  entry: Block,
): string | undefined {
  const params = childBlocks(blocks, entry).find((block) => block.label === 'typeParams');
  return params === undefined ? undefined : text.slice(params.start, params.end + 1);
}

function jsonParamsLiteral(params: JsonRecord): string {
  const members = Object.entries(params).map(
    ([key, value]) =>
      `readonly ${/^[A-Za-z_$][\w$]*$/.test(key) ? key : `'${key}'`}: ${JSON.stringify(value)}`,
  );
  return `{ ${members.join('; ')} }`;
}

interface Edit {
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

function rewriteDts(
  text: string,
  expanded: ReadonlyMap<string, JsonRecord>,
  hashes: ReadonlyMap<string, string>,
): string {
  const blocks = scanBlocks(text);
  const typesBlock = storageTypesBlock(blocks);
  const entryBlocks = typesBlock === undefined ? [] : childBlocks(blocks, typesBlock);
  const literals = new Map<string, string>();
  for (const [alias, entry] of expanded) {
    const params = nonEmptyParams(entry);
    if (params === undefined) continue;
    const block = entryBlocks.find((candidate) => candidate.label === alias);
    literals.set(
      alias,
      (block === undefined ? undefined : entryParamsLiteral(text, blocks, block)) ??
        jsonParamsLiteral(params),
    );
  }
  const edits: Edit[] = [];
  for (const match of text.matchAll(/readonly typeRef:\s*(?:'([^']*)'|"([^"]*)")\s*;?/g)) {
    const alias = match[1] ?? match[2] ?? '';
    const column = innermostBlock(blocks, match.index);
    if (column === undefined || !isColumnBlock(column) || !expanded.has(alias)) continue;
    const start = lineStart(text, match.index);
    const literal = literals.get(alias);
    if (literal === undefined) {
      const end = match.index + match[0].length;
      edits.push({ start, end: text[end] === '\n' ? end + 1 : end, text: '' });
    } else {
      edits.push({
        start,
        end: match.index + match[0].length,
        text: typeParamsMember(literal, indentOf(text, match.index)),
      });
    }
  }
  if (typesBlock !== undefined) {
    const removed = entryBlocks.filter((block) => expanded.has(block.label));
    if (removed.length > 0 && removed.length === entryBlocks.length) {
      edits.push({
        start: lineStart(text, typesBlock.start),
        end: memberEnd(text, typesBlock),
        text: '',
      });
    } else {
      for (const block of removed)
        edits.push({ start: lineStart(text, block.start), end: memberEnd(text, block), text: '' });
    }
  }
  let result = text;
  for (const edit of edits.sort((a, b) => b.start - a.start))
    result = `${result.slice(0, edit.start)}${edit.text}${result.slice(edit.end)}`;
  return replaceHashTokens(result, hashes);
}

function replaceHashTokens(text: string, hashes: ReadonlyMap<string, string>): string {
  return text.replace(
    /(?<![0-9a-f])[0-9a-f]{64}(?![0-9a-f])/g,
    (hash: string) => hashes.get(hash) ?? hash,
  );
}

interface ContractPlan {
  readonly path: string;
  readonly snapshot: boolean;
  readonly oldHash: string;
  readonly newHash: string;
  readonly content: string;
  readonly expanded: ReadonlyMap<string, JsonRecord>;
  readonly kept: readonly string[];
}

function summary(
  root: string,
  contractsFound: number,
  files: number,
  directories: number,
  hashes: ReadonlyMap<string, string>,
  kept: readonly (readonly [string, readonly string[]])[],
): readonly string[] {
  if (contractsFound === 0) return [`No SQL contract was found under ${root}; nothing changed.`];
  if (files === 0 && directories === 0)
    return ['No contract stores a type alias; nothing changed.'];
  const renamed = count(directories, 'snapshot directory', 'snapshot directories');
  const changes = `Rewrote ${count(files, 'file', 'files')} and renamed ${renamed}.`;
  const lines =
    hashes.size === 0
      ? [changes]
      : [
          `${changes} Storage hashes changed (old -> new):`,
          ...[...hashes]
            .sort(([a], [b]) => compareCodeUnits(a, b))
            .map(([oldHash, newHash]) => `  ${oldHash} -> ${newHash}`),
        ];
  if (kept.length === 0) return lines;
  return [
    ...lines,
    'Kept storage.types entries that no column references. Each is a database type an extension registers, or a type alias nothing uses:',
    ...kept.map(([path, names]) => `  ${path}: ${names.join(', ')}`),
  ];
}

const JSON_FILES_THAT_MUST_PARSE = new Set(['contract.json', 'migration.json']);

function main(root: string): number {
  const display = (path: string): string => relative(root, path).split(sep).join('/');
  const files = listFiles(root);
  const plans: ContractPlan[] = [];
  const stops: string[] = [];
  let contractsFound = 0;

  for (const path of files.json) {
    const text = readFileSync(path, 'utf8');
    const contract = parseJson(text);
    if (
      contract === undefined &&
      (JSON_FILES_THAT_MUST_PARSE.has(basename(path)) || files.refs.includes(path))
    ) {
      stops.push(`${display(path)}: not valid JSON`);
      continue;
    }
    if (
      !isRecord(contract) ||
      contract['targetFamily'] !== 'sql' ||
      typeof contract['target'] !== 'string' ||
      !isRecord(contract['storage'])
    )
      continue;
    contractsFound++;
    const rewrite = rewriteContract(contract);
    if (!rewrite.changed) continue;
    const snapshot = isSnapshotContract(path);
    const stored = contract['storage']['storageHash'];
    const oldHash = snapshot ? basename(dirname(path)) : typeof stored === 'string' ? stored : '';
    const computed = computeStorageHash(contract);
    if (computed !== oldHash || (typeof stored === 'string' && stored !== oldHash)) {
      stops.push(
        `${display(path)}: the stored storage hash ${oldHash} does not match the contract's content, which hashes to ${computed}; restore the file from version control, or re-emit it, and run the script again`,
      );
      continue;
    }
    if (rewrite.problems.length > 0) {
      for (const problem of rewrite.problems)
        stops.push(
          `${display(path)}: ${problem}; restore the file from version control, or re-emit it, and run the script again`,
        );
      continue;
    }
    const newHash = computeStorageHash(rewrite.contract);
    plans.push({
      path,
      snapshot,
      oldHash,
      newHash,
      content: writtenForm(withStorageHash(rewrite.contract, newHash), contract, text),
      expanded: rewrite.expanded,
      kept: rewrite.kept,
    });
  }

  const hashes = new Map<string, string>();
  for (const plan of [...plans].sort((a, b) => Number(b.snapshot) - Number(a.snapshot)))
    if (plan.oldHash !== plan.newHash && !hashes.has(plan.oldHash))
      hashes.set(plan.oldHash, plan.newHash);

  const newDirectories = new Map<string, Map<string, string>>();
  const directorySources = new Map<string, string>();
  const sourceDirectories = new Set<string>();
  const removals = new Set<string>();
  const snapshotRewrites: [string, string][] = [];
  const referenceWrites = new Map<string, string>();
  const contractWrites = new Map<string, string>();
  const kept: [string, readonly string[]][] = [];
  for (const plan of plans) {
    const dtsPath = plan.snapshot
      ? join(dirname(plan.path), 'contract.d.ts')
      : `${plan.path.slice(0, -'.json'.length)}.d.ts`;
    const dtsHashes = new Map([...hashes, [plan.oldHash, plan.newHash]]);
    const dts = existsSync(dtsPath)
      ? rewriteDts(readFileSync(dtsPath, 'utf8'), plan.expanded, dtsHashes)
      : undefined;
    const writtenPath = plan.snapshot
      ? join(dirname(dirname(plan.path)), plan.newHash, 'contract.json')
      : plan.path;
    if (plan.kept.length > 0) kept.push([display(writtenPath), plan.kept]);
    if (!plan.snapshot) {
      if (dts !== undefined) referenceWrites.set(dtsPath, dts);
      contractWrites.set(plan.path, plan.content);
      continue;
    }
    const oldDir = dirname(plan.path);
    const newDir = join(dirname(oldDir), plan.newHash);
    sourceDirectories.add(oldDir);
    if (newDir === oldDir) {
      if (dts !== undefined) snapshotRewrites.push([dtsPath, dts]);
      snapshotRewrites.push([plan.path, plan.content]);
      continue;
    }
    removals.add(oldDir);
    const content = readDirectory(oldDir);
    content.set('contract.json', plan.content);
    if (dts !== undefined) content.set('contract.d.ts', dts);
    const planned = newDirectories.get(newDir);
    if (planned !== undefined && !sameFiles(planned, content)) {
      stops.push(`${display(newDir)}: snapshot directory already exists with different content`);
      continue;
    }
    newDirectories.set(newDir, content);
    directorySources.set(newDir, oldDir);
  }
  for (const [dir, content] of newDirectories) {
    if (sourceDirectories.has(dir) || !existsSync(dir)) continue;
    if (sameFiles(readDirectory(dir), content)) newDirectories.delete(dir);
    else stops.push(`${display(dir)}: snapshot directory already exists with different content`);
  }

  for (const path of files.migrationJson) {
    const text = readFileSync(path, 'utf8');
    const metadata = parseJson(text);
    if (!isRecord(metadata)) continue;
    const from = metadata['from'];
    const to = metadata['to'];
    const nextFrom = typeof from === 'string' ? (hashes.get(from) ?? from) : from;
    const nextTo = typeof to === 'string' ? (hashes.get(to) ?? to) : to;
    if (nextFrom === from && nextTo === to) continue;
    const opsPath = join(dirname(path), 'ops.json');
    const ops = existsSync(opsPath) ? parseJson(readFileSync(opsPath, 'utf8')) : undefined;
    if (existsSync(opsPath) && ops === undefined) {
      stops.push(`${display(opsPath)}: not valid JSON`);
      continue;
    }
    const oldMigrationHash = metadata['migrationHash'];
    let next = replaceQuotedHashes(text, hashes);
    if (
      ops !== undefined &&
      typeof oldMigrationHash === 'string' &&
      nextFrom !== undefined &&
      nextTo !== undefined
    ) {
      const migrationHash = computeMigrationHash({ ...metadata, from: nextFrom, to: nextTo }, ops);
      next = next.replace(`"${oldMigrationHash}"`, `"${migrationHash}"`);
    }
    referenceWrites.set(path, next);
  }
  for (const path of files.refs) {
    const text = readFileSync(path, 'utf8');
    const next = replaceQuotedHashes(text, hashes);
    if (next !== text) referenceWrites.set(path, next);
  }
  for (const path of files.migrationTs) {
    const text = readFileSync(path, 'utf8');
    const next = replaceHashTokens(text, hashes);
    if (next !== text) referenceWrites.set(path, next);
  }

  if (stops.length > 0) {
    process.stderr.write(`${[...new Set(stops)].join('\n')}\n`);
    return 1;
  }

  try {
    for (const path of files.leftovers) rmSync(path, { recursive: true, force: true });
    for (const [dir, content] of newDirectories)
      writeDirectory(dir, content, directorySources.get(dir) ?? dir);
    for (const [path, text] of snapshotRewrites) writeFile(path, text);
    for (const [path, text] of referenceWrites) writeFile(path, text);
    for (const [path, text] of contractWrites) writeFile(path, text);
    for (const dir of removals) removeDirectory(dir);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(
      `${message}; the upgrade stopped partway, run the script again to finish it\n`,
    );
    return 1;
  }
  const rewrittenFiles = snapshotRewrites.length + referenceWrites.size + contractWrites.size;
  const lines = summary(
    root,
    contractsFound,
    rewrittenFiles,
    removals.size,
    hashes,
    kept.sort(([a], [b]) => compareCodeUnits(a, b)),
  );
  process.stdout.write(`${lines.join('\n')}\n`);
  return 0;
}

process.exitCode = main(resolve(process.argv[2] ?? '.'));

/**
 * Builds the before and after fixture projects from live framework code. The before side is a project as an earlier release stored it: each column typed by a `types {}` alias carries a `typeRef` naming a `storage.types` entry that holds the alias's params. The after side is what the upgrade makes of it: the params on the column, the referenced entries gone, an entry no column references kept, and every hash refreshed. The project also holds pgvector's space snapshot, whose `vector` entry no column references. This holds only while the fragment is pending; see the record-upgrade-instructions skill for what happens to it at release.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import postgresAdapter from '@internal/adapter-postgres/control';
import { enrichContract } from '@internal/cli/control-api';
import { computeStorageHash, type SerializeContract } from '@internal/contract/hashing';
import type { Contract } from '@internal/contract/types';
import { emit } from '@internal/emitter';
import pgvector from '@internal/extension-pgvector/control';
import sql from '@internal/family-sql/control';
import { createControlStack } from '@internal/framework-components/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { sqlContractCanonicalizationHooks } from '@internal/sql-contract/canonicalization-hooks';
import { sqlEmission } from '@internal/sql-contract-emitter';
import { prismaContract } from '@internal/sql-contract-psl/provider';
import postgres from '@internal/target-postgres/control';
import postgresPackRef from '@internal/target-postgres/pack';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { postgresCreateNamespace } from '@internal/target-postgres/types';
import type { JsonObject } from '@internal/utils/json';
import { join } from 'pathe';
import { makeWorkDir, repoRoot, type Tree } from './test-helpers';

type JsonRecord = Record<string, unknown>;

const serializer = new PostgresContractSerializer();
const stack = createControlStack({
  family: sql,
  target: postgres,
  adapter: postgresAdapter,
  extensions: [pgvector],
});
const family = sql.create(stack);

interface Source {
  readonly psl: string;
  /** The alias each aliased column of table `post` is typed by. */
  readonly aliased: Readonly<Record<string, string>>;
  /** Aliases the source declares that no column uses; an earlier release stored them too. */
  readonly unused: Readonly<Record<string, JsonRecord>>;
}

export const INITIAL: Source = {
  psl: `types {
  Slug      = VarChar(64)
  Embedding = pgvector.Vector(3)
}

model Post {
  id        Int        @id
  slug      Slug
  embedding Embedding?

  @@map("post")
}
`,
  aliased: { slug: 'Slug', embedding: 'Embedding' },
  unused: {
    Code: {
      codecId: 'sql/char@1',
      dataType: 'pg/char',
      kind: 'codec-instance',
      typeParams: { length: 8 },
    },
  },
};

export const SECOND: Source = {
  psl: `types {
  Slug      = VarChar(64)
  Embedding = pgvector.Vector(3)
}

model Post {
  id        Int        @id
  slug      Slug
  title     Slug
  embedding Embedding?

  @@map("post")
}
`,
  aliased: { slug: 'Slug', title: 'Slug', embedding: 'Embedding' },
  unused: {},
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function record(value: unknown): JsonRecord {
  if (!isRecord(value)) throw new Error('fixture generator: expected an object');
  return value;
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, sortKeys(value[key])]),
  );
}

export function postColumns(contract: JsonRecord): JsonRecord {
  const storage = record(contract['storage']);
  const namespace = record(record(storage['namespaces'])['public']);
  return record(record(record(record(namespace['entries'])['table'])['post'])['columns']);
}

export function storageHashOf(contract: JsonRecord): string {
  const { storageHash: _stored, ...withoutHash } = record(contract['storage']);
  return computeStorageHash({
    target: String(contract['target']),
    targetFamily: String(contract['targetFamily']),
    storage: withoutHash,
    ...serializer.hashCanonicalizationHooks,
  });
}

export interface Emitted {
  readonly json: string;
  readonly dts: string;
  readonly hash: string;
}

const serializeContract: SerializeContract = (contract) =>
  serializer.serializeContract(
    contract as Parameters<typeof serializer.serializeContract>[0],
  ) as unknown as JsonObject;

async function emitContract(contract: Contract): Promise<Emitted> {
  const out = await emit(contract, stack, sqlEmission, {
    serializeContract,
    deserializeContract: (json) => family.deserializeContract(json),
    ...sqlContractCanonicalizationHooks,
  });
  return { json: out.contractJson, dts: out.contractDts, hash: out.storageHash };
}

/** What `prisma contract emit` writes for `psl`. */
export async function emitted(psl: string): Promise<Emitted> {
  const dir = makeWorkDir('expand-type-aliases-source-');
  const schemaPath = join(dir, 'contract.prisma');
  writeFileSync(schemaPath, `// use prisma-8\n\n${psl}`, 'utf-8');
  const result = await prismaContract(schemaPath, {
    target: postgresPackRef,
    createNamespace: postgresCreateNamespace,
  }).source.load({
    composedExtensions: [pgvector.id],
    defaultNamespaceId: stack.target.defaultNamespaceId,
    composedExtensionContracts: new Map(),
    authoringContributions: stack.authoringContributions,
    codecLookup: stack.codecLookup,
    dataTypes: stack.dataTypes,
    controlMutationDefaults: stack.controlMutationDefaults,
    generatorFunctions: stack.generatorFunctions,
    resolvedInputs: [schemaPath],
    capabilities: stack.capabilities,
  });
  if (!result.ok) {
    throw new Error(`fixture generator: the source did not build: ${JSON.stringify(result)}`);
  }
  return emitContract(
    family.deserializeContract(enrichContract(result.value, [postgres, postgresAdapter, pgvector])),
  );
}

/** What the emitter writes for a stored contract that registers `types` in `storage.types`. */
async function emittedWithTypes(json: string, types: JsonRecord): Promise<Emitted> {
  const contract = record(JSON.parse(json));
  const storage = record(contract['storage']);
  if (Object.keys(types).length > 0) storage['types'] = types;
  storage['storageHash'] = storageHashOf(contract);
  return emitContract(family.deserializeContract(contract));
}

function replaceAll(text: string, from: string, to: string): string {
  return text.split(from).join(to);
}

interface Side {
  readonly contract: JsonRecord;
  readonly dts: string;
  readonly hash: string;
}

interface Stored {
  readonly before: Side;
  readonly after: Side;
}

function aliasEntries(emittedJson: string, source: Source): JsonRecord {
  const columns = postColumns(record(JSON.parse(emittedJson)));
  const entries: JsonRecord = {};
  for (const [column, alias] of Object.entries(source.aliased)) {
    const stored = record(columns[column]);
    entries[alias] = {
      codecId: stored['codecId'],
      dataType: stored['dataType'],
      kind: 'codec-instance',
      typeParams: stored['typeParams'],
    };
  }
  return entries;
}

/** The column's `typeParams` member replaced, in place, by a `typeRef` naming its alias. */
function withTypeRef(column: JsonRecord, alias: string): JsonRecord {
  return Object.fromEntries(
    Object.entries(column).map(([key, value]) =>
      key === 'typeParams' ? ['typeRef', alias] : [key, value],
    ),
  );
}

const DTS_COLUMN_PARAMS = /^( *)readonly typeParams: (\{[^\n]*\});\n(?= *readonly many:)/gm;

/** The contract as an earlier release stored it, and what the upgrade makes of it. */
async function storedPair(source: Source): Promise<Stored> {
  const fromSource = await emitted(source.psl);
  const aliases = aliasEntries(fromSource.json, source);
  const afterEmit = await emittedWithTypes(fromSource.json, source.unused);
  const beforeEmit = await emittedWithTypes(fromSource.json, { ...aliases, ...source.unused });

  const before = record(JSON.parse(beforeEmit.json));
  const columns = postColumns(before);
  for (const [column, alias] of Object.entries(source.aliased))
    columns[column] = withTypeRef(record(columns[column]), alias);
  const beforeHash = storageHashOf(before);
  record(before['storage'])['storageHash'] = beforeHash;

  const literalAlias = new Map(
    Object.entries(aliases).map(([alias, entry]) => [
      `{ ${Object.entries(record(record(entry)['typeParams']))
        .map(([key, value]) => `readonly ${key}: ${JSON.stringify(value)}`)
        .join('; ')} }`,
      alias,
    ]),
  );
  const beforeDts = beforeEmit.dts.replace(
    DTS_COLUMN_PARAMS,
    (match: string, indent: string, literal: string) => {
      const alias = literalAlias.get(literal);
      return alias === undefined ? match : `${indent}readonly typeRef: '${alias}';\n`;
    },
  );
  return {
    before: {
      contract: before,
      dts: replaceAll(beforeDts, beforeEmit.hash, beforeHash),
      hash: beforeHash,
    },
    after: {
      contract: record(JSON.parse(afterEmit.json)),
      dts: afterEmit.dts,
      hash: afterEmit.hash,
    },
  };
}

function snapshotForm(contract: JsonRecord): string {
  return `${JSON.stringify(sortKeys(contract))}\n`;
}

function snapshotImports(role: 'Start' | 'End', hash: string): readonly string[] {
  const value = role === 'Start' ? 'startContract' : 'endContract';
  return [
    `import type { Contract as ${role} } from '../../snapshots/${hash}/contract';`,
    `import ${value} from '../../snapshots/${hash}/contract.json' with {`,
    "  type: 'json',",
    '};',
  ];
}

/** A `migration.ts` of the shape `prisma migration plan` writes, its snapshot imports sorted as the formatter sorts them. */
export function migrationTs(from: string | null, to: string): string {
  const imports = [
    { hash: to, lines: snapshotImports('End', to) },
    ...(from === null ? [] : [{ hash: from, lines: snapshotImports('Start', from) }]),
  ].sort((a, b) => (a.hash < b.hash ? -1 : 1));
  const contracts =
    from === null
      ? ['  override readonly endContractJson = endContract;']
      : [
          '  override readonly startContractJson = startContract;',
          '  override readonly endContractJson = endContract;',
        ];
  return [
    '#!/usr/bin/env -S node',
    "import { Migration, MigrationCLI } from '@internal/postgres/migration';",
    ...imports.flatMap((entry) => entry.lines),
    '',
    `export default class M extends Migration<${from === null ? 'never' : 'Start'}, End> {`,
    ...contracts,
    '',
    '  override get operations() {',
    '    return [];',
    '  }',
    '}',
    '',
    'MigrationCLI.run(import.meta.url, M);',
    '',
  ].join('\n');
}

function migrationPackage(name: string, from: string | null, to: string, createdAt: string): Tree {
  const metadata = { from, to, providedInvariants: [], createdAt };
  const migrationHash = computeMigrationHash(metadata, []);
  return {
    [`migrations/app/${name}/migration.json`]: `${JSON.stringify({ ...metadata, migrationHash }, null, 2)}\n`,
    [`migrations/app/${name}/ops.json`]: '[]\n',
    [`migrations/app/${name}/migration.ts`]: migrationTs(from, to),
  };
}

function pgvectorSpace(): Tree {
  const source = join(repoRoot, 'packages/3-extensions/pgvector/src');
  const contract = record(JSON.parse(readFileSync(join(source, 'contract.json'), 'utf8')));
  const hash = String(record(contract['storage'])['storageHash']);
  return {
    [`migrations/snapshots/${hash}/contract.json`]: snapshotForm(contract),
    [`migrations/snapshots/${hash}/contract.d.ts`]: readFileSync(
      join(source, 'contract.d.ts'),
      'utf8',
    ),
    'migrations/pgvector/refs/head.json': `${JSON.stringify({ hash, invariants: [] }, null, 2)}\n`,
  };
}

function project(initial: Side, second: Side): Tree {
  return {
    'prisma/contract.prisma': SECOND.psl,
    'prisma/contract.json': JSON.stringify(second.contract, null, 2),
    'prisma/contract.d.ts': second.dts,
    [`migrations/snapshots/${initial.hash}/contract.json`]: snapshotForm(initial.contract),
    [`migrations/snapshots/${initial.hash}/contract.d.ts`]: initial.dts,
    [`migrations/snapshots/${second.hash}/contract.json`]: snapshotForm(second.contract),
    [`migrations/snapshots/${second.hash}/contract.d.ts`]: second.dts,
    ...migrationPackage('20260101T0000_initial', null, initial.hash, '2026-01-01T00:00:00.000Z'),
    'migrations/app/20260101T0000_initial/contract.prisma': INITIAL.psl,
    ...migrationPackage(
      '20260201T0000_add_title',
      initial.hash,
      second.hash,
      '2026-02-01T00:00:00.000Z',
    ),
    'migrations/app/20260201T0000_add_title/contract.prisma': SECOND.psl,
    'migrations/app/refs/head.json': `${JSON.stringify({ hash: second.hash, invariants: [] }, null, 2)}\n`,
    ...pgvectorSpace(),
  };
}

export interface Fixtures {
  readonly before: Tree;
  readonly after: Tree;
  readonly hashes: readonly (readonly [string, string])[];
}

export async function generateFixtures(): Promise<Fixtures> {
  const initial = await storedPair(INITIAL);
  const second = await storedPair(SECOND);
  return {
    before: project(initial.before, second.before),
    after: project(initial.after, second.after),
    hashes: [
      [initial.before.hash, initial.after.hash],
      [second.before.hash, second.after.hash],
    ],
  };
}

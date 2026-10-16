/**
 * Builds the before and after fixture projects from live framework code. The before side is a project as an earlier release stored it: list and enum columns whose check was waived carry a `noCheck` key and lack the check. The after side is what the upgrade makes of it: the key removed, a list whose element check was waived made element-nullable in storage, in the domain and in `contract.d.ts`, and every hash refreshed. This holds only while the fragment is pending; see the record-upgrade-instructions skill for what happens to it at release.
 */
import { computeStorageHash, type SerializeContract } from '@internal/contract/hashing';
import { emit } from '@internal/emitter';
import sql from '@internal/family-sql/control';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { sqlContractCanonicalizationHooks } from '@internal/sql-contract/canonicalization-hooks';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import type { JsonObject } from '@internal/utils/json';
import { authorSqlContractFromPsl, sqlStack } from '../../scalar-lists/psl-list-authoring';
import type { Tree } from './test-helpers';

type JsonRecord = Record<string, unknown>;

const serializer = new PostgresContractSerializer();

interface Source {
  /** The source as an earlier release read it. */
  readonly before: string;
  /** The same source after the fragment's rule: `T[] @noCheck(elementNotNull)` becomes `T?[]`, `@noCheck(membership)` is deleted. */
  readonly rewritten: string;
  /** The columns whose check the earlier source waived, and the kind it waived. */
  readonly waived: Readonly<Record<string, 'elementNotNull' | 'membership'>>;
}

const PRIORITY = `enum Priority {
  @@type("pg/text@1")
  Low  = "low"
  High = "high"
}
`;

export const INITIAL: Source = {
  before: `${PRIORITY}
model Post {
  id     Int      @id
  tags   String[]
  legacy Priority

  @@map("post")
}
`,
  rewritten: `${PRIORITY}
model Post {
  id     Int       @id
  tags   String?[]
  legacy Priority

  @@map("post")
}
`,
  waived: { tags: 'elementNotNull', legacy: 'membership' },
};

export const SECOND: Source = {
  before: `model Post {
  id     Int      @id
  tags   String[]
  labels String[]
  scores Int[]

  @@map("post")
}
`,
  rewritten: `model Post {
  id     Int       @id
  tags   String?[]
  labels String?[]
  scores Int[]

  @@map("post")
}
`,
  waived: { tags: 'elementNotNull', labels: 'elementNotNull' },
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

function postTable(contract: JsonRecord): JsonRecord {
  const storage = record(contract['storage']);
  const namespace = record(record(storage['namespaces'])['public']);
  return record(record(record(namespace['entries'])['table'])['post']);
}

function postFields(contract: JsonRecord): JsonRecord {
  const domain = record(contract['domain']);
  const namespace = record(record(domain['namespaces'])['public']);
  return record(record(record(namespace['models'])['Post'])['fields']);
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

function withHash(contract: JsonRecord): string {
  const hash = storageHashOf(contract);
  record(contract['storage'])['storageHash'] = hash;
  return hash;
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

/** What `prisma contract emit` writes for `source`. */
export async function emitted(source: string): Promise<Emitted> {
  const result = await authorSqlContractFromPsl(source);
  if (result.contract === undefined) {
    throw new Error(`fixture generator: the source did not build: ${JSON.stringify(result)}`);
  }
  const family = sql.create(sqlStack);
  const out = await emit(result.contract, sqlStack, sql.emission, {
    serializeContract,
    deserializeContract: (json) => family.deserializeContract(json),
    ...sqlContractCanonicalizationHooks,
  });
  return {
    json: out.contractJson,
    dts: out.contractDts,
    hash: result.contract.storage.storageHash,
  };
}

function replaceHash(text: string, from: string, to: string): string {
  return text.split(from).join(to);
}

interface Stored {
  readonly before: { readonly contract: JsonRecord; readonly dts: string; readonly hash: string };
  readonly after: { readonly contract: JsonRecord; readonly dts: string; readonly hash: string };
}

/** The contract as an earlier release stored it, and what the upgrade makes of it. */
async function storedPair(source: Source): Promise<Stored> {
  const emittedBefore = await emitted(source.before);
  const before = record(JSON.parse(emittedBefore.json));
  const table = postTable(before);
  const columns = record(table['columns']);
  const checks = Array.isArray(table['checks']) ? table['checks'] : [];
  const keptChecks = checks.filter((check) => {
    const name = String(record(check)['name']);
    return !Object.keys(source.waived).some((column) => name.startsWith(`post_${column}_`));
  });
  if (keptChecks.length > 0) table['checks'] = keptChecks;
  else delete table['checks'];
  for (const [column, kind] of Object.entries(source.waived))
    record(columns[column])['noCheck'] = [kind];
  const beforeHash = withHash(before);

  const after = record(JSON.parse(JSON.stringify(before)));
  const afterColumns = record(postTable(after)['columns']);
  for (const [column, kind] of Object.entries(source.waived)) {
    const stored = record(afterColumns[column]);
    delete stored['noCheck'];
    if (kind === 'elementNotNull') {
      stored['many'] = { elementNullable: true };
      record(postFields(after)[column])['many'] = { elementNullable: true };
    }
  }
  const afterHash = withHash(after);
  const emittedRewritten = await emitted(source.rewritten);
  return {
    before: {
      contract: before,
      dts: replaceHash(emittedBefore.dts, emittedBefore.hash, beforeHash),
      hash: beforeHash,
    },
    after: {
      contract: after,
      dts: replaceHash(emittedRewritten.dts, emittedRewritten.hash, afterHash),
      hash: afterHash,
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

interface Side {
  readonly contract: JsonRecord;
  readonly dts: string;
  readonly hash: string;
}

function project(initial: Side, second: Side): Tree {
  return {
    'prisma/contract.json': JSON.stringify(second.contract, null, 2),
    'prisma/contract.d.ts': second.dts,
    [`migrations/snapshots/${initial.hash}/contract.json`]: snapshotForm(initial.contract),
    [`migrations/snapshots/${initial.hash}/contract.d.ts`]: initial.dts,
    [`migrations/snapshots/${second.hash}/contract.json`]: snapshotForm(second.contract),
    [`migrations/snapshots/${second.hash}/contract.d.ts`]: second.dts,
    ...migrationPackage('20260101T0000_initial', null, initial.hash, '2026-01-01T00:00:00.000Z'),
    ...migrationPackage(
      '20260201T0000_add_labels',
      initial.hash,
      second.hash,
      '2026-02-01T00:00:00.000Z',
    ),
    'migrations/app/refs/head.json': `${JSON.stringify({ hash: second.hash, invariants: [] }, null, 2)}\n`,
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

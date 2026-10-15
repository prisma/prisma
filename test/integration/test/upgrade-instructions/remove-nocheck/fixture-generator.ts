/**
 * Builds the before and after fixture projects from live framework code. The before side is a
 * project as an earlier release stored it: list and enum columns whose check was waived carry a
 * `noCheck` key and lack the check. The after side is the same project with only the key removed,
 * rehashed. This holds only while the fragment is pending; see the record-upgrade-instructions
 * skill for what happens to it at release.
 */
import { computeStorageHash } from '@internal/contract/hashing';
import { computeMigrationHash } from '@internal/migration-tools/hash';
import { PostgresContractSerializer } from '@internal/target-postgres/runtime';
import { authorSqlContractFromPsl } from '../../scalar-lists/psl-list-authoring';
import type { Tree } from './test-helpers';

type JsonRecord = Record<string, unknown>;

const serializer = new PostgresContractSerializer();

const INITIAL_SOURCE = `model Post {
  id   Int      @id
  tags String[]

  @@map("post")
}
`;

const SECOND_SOURCE = `enum Priority {
  @@type("pg/text@1")
  Low  = "low"
  High = "high"
}

model Post {
  id       Int      @id
  tags     String[]
  labels   String[]
  scores   Int[]
  priority Priority

  @@map("post")
}
`;

/** The columns whose check each source waived, and the kind it waived. */
const WAIVED: Readonly<Record<string, Readonly<Record<string, string>>>> = {
  initial: { tags: 'elementNotNull' },
  second: { tags: 'elementNotNull', labels: 'elementNotNull', priority: 'membership' },
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

function rehash(contract: JsonRecord): string {
  const storage = record(contract['storage']);
  const { storageHash: _stored, ...withoutHash } = storage;
  const hash = computeStorageHash({
    target: String(contract['target']),
    targetFamily: String(contract['targetFamily']),
    storage: withoutHash,
    ...serializer.hashCanonicalizationHooks,
  });
  storage['storageHash'] = hash;
  return hash;
}

async function emittedJson(source: string): Promise<JsonRecord> {
  const result = await authorSqlContractFromPsl(source);
  if (result.contract === undefined) {
    throw new Error(`fixture generator: the source did not build: ${JSON.stringify(result)}`);
  }
  return record(JSON.parse(JSON.stringify(serializer.serializeContract(result.contract))));
}

interface Stored {
  readonly before: JsonRecord;
  readonly after: JsonRecord;
  readonly beforeHash: string;
  readonly afterHash: string;
}

/** The contract as an earlier release stored it, and the same contract with only `noCheck` removed. */
async function storedPair(
  source: string,
  waived: Readonly<Record<string, string>>,
): Promise<Stored> {
  const before = await emittedJson(source);
  const table = postTable(before);
  const columns = record(table['columns']);
  const checks = Array.isArray(table['checks']) ? table['checks'] : [];
  const keptChecks = checks.filter((check) => {
    const name = String(record(check)['name']);
    return !Object.keys(waived).some((column) => name.startsWith(`post_${column}_`));
  });
  if (keptChecks.length > 0) table['checks'] = keptChecks;
  else delete table['checks'];
  for (const [column, kind] of Object.entries(waived)) record(columns[column])['noCheck'] = [kind];
  const beforeHash = rehash(before);

  const after = record(JSON.parse(JSON.stringify(before)));
  for (const column of Object.keys(waived))
    delete record(record(postTable(after)['columns'])[column])['noCheck'];
  const afterHash = rehash(after);
  return { before, after, beforeHash, afterHash };
}

function emittedForm(contract: JsonRecord): string {
  return `${JSON.stringify(contract, null, 2)}\n`;
}

function snapshotForm(contract: JsonRecord): string {
  return `${JSON.stringify(sortKeys(contract))}\n`;
}

function contractDts(hash: string): string {
  return [
    "import type { StorageHashBase } from '@prisma/orm-postgres/contract-types';",
    '',
    `export type StorageHash = StorageHashBase<'${hash}'>;`,
    '',
  ].join('\n');
}

function migrationTs(from: string | null, to: string): string {
  const snapshot = (hash: string | null) => (hash === null ? 'null' : `'${hash}'`);
  return [
    'export const snapshots = {',
    `  start: ${snapshot(from)},`,
    `  end: ${snapshot(to)},`,
    '};',
    '',
  ].join('\n');
}

function migrationPackage(name: string, from: string | null, to: string, createdAt: string): Tree {
  const ops: unknown[] = [];
  const metadata = { from, to, providedInvariants: [], createdAt };
  const migrationHash = computeMigrationHash(metadata, []);
  return {
    [`migrations/app/${name}/migration.json`]: `${JSON.stringify({ ...metadata, migrationHash }, null, 2)}\n`,
    [`migrations/app/${name}/ops.json`]: `${JSON.stringify(ops)}\n`,
    [`migrations/app/${name}/migration.ts`]: migrationTs(from, to),
  };
}

function project(
  initial: { readonly contract: JsonRecord; readonly hash: string },
  second: { readonly contract: JsonRecord; readonly hash: string },
): Tree {
  return {
    'prisma/contract.json': emittedForm(second.contract),
    'prisma/contract.d.ts': contractDts(second.hash),
    [`migrations/snapshots/${initial.hash}/contract.json`]: snapshotForm(initial.contract),
    [`migrations/snapshots/${initial.hash}/contract.d.ts`]: contractDts(initial.hash),
    [`migrations/snapshots/${second.hash}/contract.json`]: snapshotForm(second.contract),
    [`migrations/snapshots/${second.hash}/contract.d.ts`]: contractDts(second.hash),
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
  const initial = await storedPair(INITIAL_SOURCE, WAIVED['initial'] ?? {});
  const second = await storedPair(SECOND_SOURCE, WAIVED['second'] ?? {});
  return {
    before: project(
      { contract: initial.before, hash: initial.beforeHash },
      { contract: second.before, hash: second.beforeHash },
    ),
    after: project(
      { contract: initial.after, hash: initial.afterHash },
      { contract: second.after, hash: second.afterHash },
    ),
    hashes: [
      [initial.beforeHash, initial.afterHash],
      [second.beforeHash, second.afterHash],
    ],
  };
}

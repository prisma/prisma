import { type Contract, coreHash, profileHash } from '@internal/contract/types';
import { INIT_ADDITIVE_POLICY } from '@internal/family-sql/control';
import {
  APP_SPACE_ID,
  type MigrationOperationPolicy,
} from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { CheckConstraint, SqlStorage, type StorageTable } from '@internal/sql-contract/types';
import { defineContract } from '@internal/sql-contract-ts/contract-builder';
import { composeCheckWirePrefix, computeCheckContentHash } from '@internal/sql-schema-ir/naming';
import {
  PostgresDatabaseSchemaNode,
  postgresCreateNamespace,
  postgresRenderCheckExpressions,
} from '@internal/target-postgres/types';
import { assertDefined } from '@internal/utils/assertions';
import { applicationDomainOf } from '@repo/test-utils';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  controlAdapter,
  createDriver,
  createTestDatabase,
  emptySchema,
  familyInstance,
  formatRunnerFailure,
  frameworkComponents,
  type PostgresControlDriver,
  postgresTargetDescriptor,
  resetDatabase,
  synthEdges,
  testTimeout,
} from './fixtures/runner-fixtures';

const FULL_POLICY: MigrationOperationPolicy = {
  allowedOperationClasses: ['additive', 'widening', 'destructive'],
};

// Minimal authoring packs for the defineContract-driven scenario: the family
// contributes the `text` field preset and the target contributes the real
// Postgres check renderer, so the built contract's checks (and the
// `.noCheck()` opt-out) come from the production emission path.
const authoringFamilyPack = {
  kind: 'family',
  id: 'sql',
  familyId: 'sql',
  version: '0.0.1',
  authoring: {
    field: {
      text: {
        kind: 'fieldPreset',
        output: { codecId: 'pg/text@1', nativeType: 'text' },
      },
    },
  },
} as const;

const authoringTargetPack = {
  kind: 'target',
  id: 'postgres',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  defaultNamespaceId: 'public',
  authoring: { field: {}, renderCheckExpressions: postgresRenderCheckExpressions },
} as const;

type ColumnSpec = {
  readonly nativeType: string;
  readonly codecId: string;
  readonly nullable: boolean;
  readonly many?: true;
};

/** Builds the checks the Postgres pack would emit for one column. */
function checksForColumn(
  tableName: string,
  columnName: string,
  options: { readonly many: boolean; readonly memberValues?: readonly string[] },
): CheckConstraint[] {
  return postgresRenderCheckExpressions({
    tableName,
    columnName,
    many: options.many,
    memberValues: options.memberValues,
  }).map(
    (candidate) =>
      new CheckConstraint({
        naming: {
          kind: 'wire',
          prefix: composeCheckWirePrefix(tableName, candidate.columnName, candidate.kind),
          hash: computeCheckContentHash(candidate.expression),
        },
        expression: candidate.expression,
      }),
  );
}

function contractOf(
  columns: Record<string, ColumnSpec>,
  checks: readonly CheckConstraint[],
): Contract<SqlStorage> {
  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash('check-lifecycle'),
    storage: new SqlStorage({
      storageHash: coreHash(JSON.stringify([Object.keys(columns), checks.map((c) => c.name)])),
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: postgresCreateNamespace({
          id: UNBOUND_NAMESPACE_ID,
          entries: {
            table: {
              Item: {
                columns,
                primaryKey: { columns: ['id'] },
                uniques: [],
                indexes: [],
                foreignKeys: [],
                ...(checks.length > 0 ? { checks: [...checks] } : {}),
              },
            },
          },
        }),
      },
    }),
    roots: {},
    domain: applicationDomainOf({ models: {} }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

const SECOND_NAMESPACE_ID = 'audit';

/**
 * The same `Item` table in two schemas. Both carry a `role` column, so the
 * checks the builder derives for them have identical physical names — the
 * shape the deleted direct-walk strategy could not plan.
 */
function twoNamespaceContractOf(
  columns: Record<string, ColumnSpec>,
  publicChecks: readonly CheckConstraint[],
  auditChecks: readonly CheckConstraint[],
): Contract<SqlStorage> {
  const tableOf = (checks: readonly CheckConstraint[]) => ({
    columns,
    primaryKey: { columns: ['id'] },
    uniques: [],
    indexes: [],
    foreignKeys: [],
    checks: [...checks],
  });
  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash('check-lifecycle'),
    storage: new SqlStorage({
      storageHash: coreHash(
        JSON.stringify([
          Object.keys(columns),
          publicChecks.map((c) => c.name),
          auditChecks.map((c) => c.name),
        ]),
      ),
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: postgresCreateNamespace({
          id: UNBOUND_NAMESPACE_ID,
          entries: { table: { Item: tableOf(publicChecks) } },
        }),
        [SECOND_NAMESPACE_ID]: postgresCreateNamespace({
          id: SECOND_NAMESPACE_ID,
          entries: { table: { Item: tableOf(auditChecks) } },
        }),
      },
    }),
    roots: {},
    domain: applicationDomainOf({ models: {} }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

const idColumn: ColumnSpec = { nativeType: 'text', codecId: 'pg/text@1', nullable: false };

function declaredCheckNames(contract: Contract<SqlStorage>): readonly string[] {
  const table = contract.storage.namespaces[UNBOUND_NAMESPACE_ID]?.entries.table?.['Item'];
  return ((table as StorageTable | undefined)?.checks ?? []).map((c) => c.name);
}

describe.sequential('check-constraint lifecycle', () => {
  let database: Awaited<ReturnType<typeof createTestDatabase>>;
  let driver: PostgresControlDriver | undefined;

  beforeAll(async () => {
    database = await createTestDatabase();
  }, testTimeout);

  afterAll(async () => {
    if (database) await database.close();
  }, testTimeout);

  beforeEach(async () => {
    driver = await createDriver(database.connectionString);
    await resetDatabase(driver);
    // `resetDatabase` only knows about `public`; the multi-namespace scenario
    // creates a second schema that has to go with it.
    await driver.query(`drop schema if exists "${SECOND_NAMESPACE_ID}" cascade`);
  }, testTimeout);

  afterEach(async () => {
    if (driver) {
      await driver.close();
      driver = undefined;
    }
  }, testTimeout);

  const planner = () => postgresTargetDescriptor.createPlanner(controlAdapter);
  const runner = () => postgresTargetDescriptor.createRunner(familyInstance);

  /** Plans `contract` against the live database and applies it. */
  async function migrate(
    contract: Contract<SqlStorage>,
    options: {
      readonly from?: Contract<SqlStorage>;
      readonly policy?: MigrationOperationPolicy;
      readonly strictVerification?: boolean;
    } = {},
  ) {
    const schema =
      options.from === undefined
        ? emptySchema
        : await familyInstance.introspect({ driver: driver!, contract: options.from });
    const policy = options.policy ?? INIT_ADDITIVE_POLICY;
    const planResult = planner().plan({
      contract,
      schema,
      policy,
      fromContract: null,
      frameworkComponents,
      spaceId: APP_SPACE_ID,
      snapshotsImportPath: '../../snapshots',
    });
    if (planResult.kind !== 'success') {
      throw new Error(`planner failed: ${JSON.stringify(planResult, null, 2)}`);
    }
    const opIds = (await Promise.all(planResult.plan.operations)).map((op) => op.id);
    const runResult = await runner().execute({
      driver: driver!,
      perSpaceOptions: [
        {
          space: APP_SPACE_ID,
          plan: planResult.plan,
          migrationEdges: synthEdges(planResult.plan),
          driver: driver!,
          destinationContract: contract,
          policy,
          frameworkComponents,
          ...(options.strictVerification !== undefined
            ? { strictVerification: options.strictVerification }
            : {}),
        },
      ],
    });
    if (!runResult.ok) {
      throw new Error(`runner failed:\n${formatRunnerFailure(runResult.failure)}`);
    }
    const ops = await Promise.all(planResult.plan.operations);
    return { opIds, ops };
  }

  async function verify(contract: Contract<SqlStorage>, strict = true) {
    const schema = await familyInstance.introspect({ driver: driver!, contract });
    return familyInstance.verifySchema({ contract, schema, strict, frameworkComponents });
  }

  async function liveCheckNames(schemaName = 'public'): Promise<readonly string[]> {
    const rows = await driver!.query<{ conname: string }>(
      `SELECT c.conname FROM pg_catalog.pg_constraint c
         JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = $1 AND t.relname = 'Item' AND c.contype = 'c'
        ORDER BY c.conname`,
      [schemaName],
    );
    return rows.rows.map((r) => r.conname);
  }

  it('adding a list column later installs its element check by ALTER', {
    timeout: testTimeout,
  }, async () => {
    const before = contractOf({ id: idColumn }, []);
    await migrate(before);
    expect(await liveCheckNames()).toEqual([]);

    // Nullable: ADD COLUMN NOT NULL with no default is rejected outright.
    const tagsChecks = checksForColumn('Item', 'tags', { many: true });
    const after = contractOf(
      {
        id: idColumn,
        tags: { nativeType: 'text', codecId: 'pg/text@1', nullable: true, many: true },
      },
      tagsChecks,
    );
    const { opIds } = await migrate(after, { from: before, policy: FULL_POLICY });

    // The column and its check both arrive by ALTER — no CREATE TABLE here.
    expect(opIds.some((id) => id.startsWith('column.'))).toBe(true);
    expect(opIds).toContain(`checkConstraint.Item.${tagsChecks[0]?.name}`);
    expect(await liveCheckNames()).toEqual(declaredCheckNames(after));
    expect((await verify(after)).ok).toBe(true);
  });

  // Dropping the column drops its check with it, so the plan must order the
  // check's drop BEFORE the column's. The diff-tree ids happen to order that
  // way for every column name (`check:` sorts before `column:`), so this
  // ordering assertion holds with or without the check node's `dependsOn`
  // edge; the edge — which makes the order declared rather than incidental —
  // is pinned by the unit assertion in contract-to-schema-ir.test.ts. What
  // this scenario proves is the lifecycle outcome: column and check drop
  // together in one plan that applies cleanly and verifies clean after.
  it('dropping a list column removes its element check in the same plan', {
    timeout: testTimeout,
  }, async () => {
    const attrsChecks = checksForColumn('Item', 'attrs', { many: true });
    const before = contractOf(
      {
        id: idColumn,
        attrs: { nativeType: 'text', codecId: 'pg/text@1', nullable: true, many: true },
      },
      attrsChecks,
    );
    await migrate(before);
    expect(await liveCheckNames()).toEqual([attrsChecks[0]?.name]);

    const after = contractOf({ id: idColumn }, []);
    const { opIds } = await migrate(after, { from: before, policy: FULL_POLICY });

    const dropCheckAt = opIds.findIndex((id) => id.startsWith('dropCheckConstraint.'));
    const dropColumnAt = opIds.findIndex((id) => id.startsWith('dropColumn.'));
    expect(dropCheckAt).toBeGreaterThanOrEqual(0);
    expect(dropColumnAt).toBeGreaterThanOrEqual(0);
    expect(dropCheckAt).toBeLessThan(dropColumnAt);

    expect(await liveCheckNames()).toEqual([]);
    expect((await verify(after)).ok).toBe(true);
  });

  it('a manually dropped check is reported missing and repaired by the next plan', {
    timeout: testTimeout,
  }, async () => {
    const tagsChecks = checksForColumn('Item', 'tags', { many: true });
    const contract = contractOf(
      {
        id: idColumn,
        tags: { nativeType: 'text', codecId: 'pg/text@1', nullable: false, many: true },
      },
      tagsChecks,
    );
    await migrate(contract);
    const checkName = tagsChecks[0]?.name ?? '';

    await driver!.query(`ALTER TABLE "Item" DROP CONSTRAINT "${checkName}"`);
    expect(await liveCheckNames()).toEqual([]);

    const drifted = await verify(contract);
    expect(drifted.ok).toBe(false);
    expect(
      drifted.schema.issues.filter((i) => i.path[i.path.length - 1] === `check:${checkName}`),
    ).toHaveLength(1);

    const { opIds } = await migrate(contract, { from: contract, policy: FULL_POLICY });
    expect(opIds).toContain(`checkConstraint.Item.${checkName}`);
    expect(await liveCheckNames()).toEqual([checkName]);
    expect((await verify(contract)).ok).toBe(true);
  });

  it('a legacy unsuffixed database converges to wire names under a full policy', {
    timeout: testTimeout,
  }, async () => {
    // The old model's names: no content-hash suffix.
    await driver!.query(
      `CREATE TABLE "Item" (
           id text PRIMARY KEY,
           role text NOT NULL,
           tags text[] NOT NULL,
           CONSTRAINT "Item_role_check" CHECK (role IN ('user', 'admin')),
           CONSTRAINT "Item_tags_elem_not_null" CHECK (array_position(tags, NULL) IS NULL)
         )`,
    );

    const checks = [
      ...checksForColumn('Item', 'role', { many: false, memberValues: ['user', 'admin'] }),
      ...checksForColumn('Item', 'tags', { many: true }),
    ];
    const contract = contractOf(
      {
        id: idColumn,
        role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
        tags: { nativeType: 'text', codecId: 'pg/text@1', nullable: false, many: true },
      },
      checks,
    );

    await migrate(contract, { from: contract, policy: FULL_POLICY });

    // Adoption is drop + add: the stale exact names are gone, the wire names
    // are installed, and one migration converges.
    expect(await liveCheckNames()).toEqual([...declaredCheckNames(contract)].sort());
    expect((await verify(contract)).ok).toBe(true);
  });

  it('under additive-only the new check installs and strict verify reports the stale one', {
    timeout: testTimeout,
  }, async () => {
    await driver!.query(
      `CREATE TABLE "Item" (
           id text PRIMARY KEY,
           role text NOT NULL,
           CONSTRAINT "Item_role_check" CHECK (role IN ('user', 'admin'))
         )`,
    );

    const checks = checksForColumn('Item', 'role', {
      many: false,
      memberValues: ['user', 'admin'],
    });
    const contract = contractOf(
      { id: idColumn, role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false } },
      checks,
    );

    // The runner's post-apply verify defaults to strict, which the stale extra
    // would fail — that is the finding this scenario asserts below, not a
    // reason for the apply itself to fail.
    await migrate(contract, {
      from: contract,
      policy: INIT_ADDITIVE_POLICY,
      strictVerification: false,
    });

    const wireName = checks[0]?.name ?? '';
    expect(await liveCheckNames()).toEqual(['Item_role_check', wireName].sort());

    const strict = await verify(contract, true);
    expect(strict.ok).toBe(false);
    const extras = strict.schema.issues.filter((i) =>
      i.path[i.path.length - 1]?.startsWith('check:'),
    );
    expect(extras.map((i) => i.path[i.path.length - 1])).toEqual(['check:Item_role_check']);

    // The stale extra is strict-only: a lenient verify tolerates it.
    expect((await verify(contract, false)).ok).toBe(true);
  });

  // The array-enum form is the latent bug this project fixes: the old renderer
  // emitted `IN (…)` for an array column, which Postgres rejects outright with
  // `operator does not exist: text[] = text`. A string assertion cannot tell
  // legal DDL from that, so this scenario has to reach a real database — the
  // migration applying at all is the proof.
  it('an array domain enum installs both checks and enforces them', {
    timeout: testTimeout,
  }, async () => {
    const checks = checksForColumn('Item', 'roles', {
      many: true,
      memberValues: ['user', 'admin'],
    });
    expect(checks).toHaveLength(2);
    const contract = contractOf(
      {
        id: idColumn,
        roles: { nativeType: 'text', codecId: 'pg/text@1', nullable: false, many: true },
      },
      checks,
    );

    await migrate(contract);

    // Containment and element-non-null both live on the column.
    expect(await liveCheckNames()).toEqual([...declaredCheckNames(contract)].sort());

    const membershipName = checks[0]?.name;
    assertDefined(membershipName, 'membership check must be named');
    await driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('a', ARRAY['user','admin'])`);
    // Naming the constraint in the assertion proves the containment check is
    // what rejected the row, not some incidental failure.
    await expect(
      driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('b', ARRAY['user','root'])`),
    ).rejects.toThrow(new RegExp(membershipName));
    // `<@` does not match a NULL element either, so containment rejects this
    // one too — the element-non-null check is belt for a different hole (a
    // list column with no member set at all).
    await expect(
      driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('c', ARRAY['user',NULL])`),
    ).rejects.toThrow(/Item_roles/);

    const schema = await familyInstance.introspect({ driver: driver!, contract });
    PostgresDatabaseSchemaNode.assert(schema);
    const live = schema.namespaces['public']?.tables['Item']?.checks ?? [];
    expect([...live.map((c) => c.expression)].sort()).toEqual([
      '(array_position(roles, NULL::text) IS NULL)',
      `(roles <@ ARRAY['user'::text, 'admin'::text])`,
    ]);

    expect((await verify(contract)).ok).toBe(true);
    // Reprint stability: the containment shape does not drift on re-verify.
    expect((await verify(contract)).ok).toBe(true);
  });

  // The `<@` operands must share a type. A varchar-backed array enum meeting a
  // bare `text[]` literal raises `operator does not exist: character varying[]
  // <@ text[]` — the same class of defect as the original IN-on-an-array bug,
  // and equally invisible to a rendered-string assertion.
  it('a varchar-backed array domain enum installs and enforces', {
    timeout: testTimeout,
  }, async () => {
    const checks = checksForColumn('Item', 'roles', {
      many: true,
      memberValues: ['user', 'admin'],
    });
    const contract = contractOf(
      {
        id: idColumn,
        roles: {
          nativeType: 'character varying',
          codecId: 'pg/varchar@1',
          nullable: false,
          many: true,
        },
      },
      checks,
    );

    await migrate(contract);
    expect(await liveCheckNames()).toEqual([...declaredCheckNames(contract)].sort());

    const varcharMembershipName = checks[0]?.name;
    assertDefined(varcharMembershipName, 'membership check must be named');
    await driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('a', ARRAY['user','admin'])`);
    await expect(
      driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('b', ARRAY['user','root'])`),
    ).rejects.toThrow(new RegExp(varcharMembershipName));
    await expect(
      driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('c', ARRAY['user',NULL])`),
    ).rejects.toThrow(/Item_roles/);

    expect((await verify(contract)).ok).toBe(true);
    expect((await verify(contract)).ok).toBe(true);
  });

  // Postgres truncates identifiers at 63 BYTES. A prefix of Cyrillic
  // characters sits far under 54 characters and far over 54 bytes, so a
  // character-based cap would declare a name the database silently shortens —
  // leaving the check permanently missing and the live one permanently extra.
  it('a multibyte column name yields a check name Postgres stores unmangled', {
    timeout: testTimeout,
  }, async () => {
    const columnName = 'электронная_почта_адрес';
    const checks = checksForColumn('Item', columnName, {
      many: false,
      memberValues: ['да', 'нет'],
    });
    const contract = contractOf(
      {
        id: idColumn,
        [columnName]: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
      },
      checks,
    );

    const declared = checks[0]?.name ?? '';
    expect(new TextEncoder().encode(declared).length).toBeLessThanOrEqual(63);

    await migrate(contract);

    // The catalog holds the declared name byte-for-byte — nothing truncated.
    expect(await liveCheckNames()).toEqual([declared]);
    expect((await verify(contract)).ok).toBe(true);
  });

  // A prefix-only change keeps the predicate — and so the content hash —
  // identical, so the two sides pair and collapse into one RENAME CONSTRAINT
  // rather than dropping and re-adding a constraint Postgres would have to
  // revalidate against every row.
  it('a prefix-only change plans exactly one RENAME CONSTRAINT', {
    timeout: testTimeout,
  }, async () => {
    const before = checksForColumn('Item', 'role', {
      many: false,
      memberValues: ['user', 'admin'],
    });
    const columns = {
      id: idColumn,
      role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
    } as const;
    const v1 = contractOf(columns, before);
    await migrate(v1);

    // Same expression under a different prefix: same hash, different name.
    const expression = before[0]?.expression ?? '';
    const renamed = new CheckConstraint({
      naming: {
        kind: 'wire',
        prefix: 'Item_role_allowed',
        hash: computeCheckContentHash(expression),
      },
      expression,
    });
    const v2 = contractOf(columns, [renamed]);

    const { opIds } = await migrate(v2, { from: v1, policy: FULL_POLICY });

    // Unqualified for the unbound namespace, matching every other op id here.
    expect(opIds).toEqual([
      `checkConstraint.${UNBOUND_NAMESPACE_ID}.Item.${before[0]?.name}.rename`,
    ]);
    expect(opIds.some((id) => id.startsWith('dropCheckConstraint.'))).toBe(false);

    expect(await liveCheckNames()).toEqual([renamed.name]);
    expect((await verify(v2)).ok).toBe(true);

    // The renamed constraint still enforces its predicate.
    await driver!.query(`INSERT INTO "Item" (id, role) VALUES ('a', 'user')`);
    await expect(
      driver!.query(`INSERT INTO "Item" (id, role) VALUES ('b', 'root')`),
    ).rejects.toThrow(new RegExp(renamed.name));
  });

  it('a varchar-column membership check does not drift after apply', {
    timeout: testTimeout,
  }, async () => {
    // Postgres reprints this predicate as
    // ((role)::text = ANY ((ARRAY[...])::text[])) — the shape that defeated
    // the old parser. Comparison is by name, so it must not read as drift.
    const checks = checksForColumn('Item', 'role', {
      many: false,
      memberValues: ['user', 'admin'],
    });
    const contract = contractOf(
      {
        id: idColumn,
        role: { nativeType: 'character varying', codecId: 'pg/varchar@1', nullable: false },
      },
      checks,
    );

    await migrate(contract);

    const schema = await familyInstance.introspect({ driver: driver!, contract });
    PostgresDatabaseSchemaNode.assert(schema);
    const live = schema.namespaces['public']?.tables['Item']?.checks ?? [];
    expect(live.map((c) => c.expression)).toEqual([
      `((role)::text = ANY ((ARRAY['user'::character varying, 'admin'::character varying])::text[]))`,
    ]);

    expect((await verify(contract)).ok).toBe(true);
    // Stable across a second introspect + verify.
    expect((await verify(contract)).ok).toBe(true);
  });

  // The deleted direct-walk strategy probed one namespace, so two schemas
  // holding identically named tables and checks planned against each other.
  it('identically named checks in two schemas migrate and plan independently', {
    timeout: testTimeout,
  }, async () => {
    const columns = {
      id: idColumn,
      role: { nativeType: 'text', codecId: 'pg/text@1', nullable: false } as ColumnSpec,
    };
    const twoMembers = checksForColumn('Item', 'role', {
      many: false,
      memberValues: ['user', 'admin'],
    });
    const sharedName = twoMembers[0]?.name ?? '';
    const both = twoNamespaceContractOf(columns, twoMembers, twoMembers);

    await migrate(both);

    // One physical name, one constraint per schema.
    expect(await liveCheckNames('public')).toEqual([sharedName]);
    expect(await liveCheckNames(SECOND_NAMESPACE_ID)).toEqual([sharedName]);
    expect((await verify(both)).ok).toBe(true);

    // Widen the member set in `audit` only. The predicate changes, so the
    // hash and the name change with it — in that schema alone.
    const threeMembers = checksForColumn('Item', 'role', {
      many: false,
      memberValues: ['user', 'admin', 'root'],
    });
    const widenedName = threeMembers[0]?.name ?? '';
    expect(widenedName).not.toBe(sharedName);

    const changed = twoNamespaceContractOf(columns, twoMembers, threeMembers);
    const { ops } = await migrate(changed, { from: both, policy: FULL_POLICY });

    const checkOps = ops
      .filter((op) => op.id.includes('heckConstraint.'))
      .map((op) => ({ id: op.id, schema: op.target.details?.schema }));
    expect(checkOps).toEqual([
      { id: `dropCheckConstraint.Item.${sharedName}`, schema: SECOND_NAMESPACE_ID },
      { id: `checkConstraint.Item.${widenedName}`, schema: SECOND_NAMESPACE_ID },
    ]);

    expect(await liveCheckNames('public')).toEqual([sharedName]);
    expect(await liveCheckNames(SECOND_NAMESPACE_ID)).toEqual([widenedName]);
    expect((await verify(changed)).ok).toBe(true);
  });

  // Slice 3 (`@noCheck`): an opted-out contract simply does not declare the
  // check. The first two scenarios are hand-built contracts and pin the
  // planner/DDL lifecycle for a check-less contract — deleting a declared
  // check plans one destructive drop, declaring it again plans one additive
  // add. The third drives the real authoring surface (defineContract +
  // .noCheck()) end to end. The full builder-to-infer chain is covered by
  // the infer e2e journeys and the print-psl emission unit tests.
  it('adding an opt-out later drops the live element check in one destructive plan', {
    timeout: testTimeout,
  }, async () => {
    const tagsChecks = checksForColumn('Item', 'tags', { many: true });
    const enforced = contractOf(
      {
        id: idColumn,
        tags: { nativeType: 'text', codecId: 'pg/text@1', nullable: false, many: true },
      },
      tagsChecks,
    );
    await migrate(enforced);
    expect(await liveCheckNames()).toEqual([tagsChecks[0]?.name]);

    // Hand-built equivalent of the opted-out contract: the builder's only
    // effect is that the check is absent, which is exactly this shape.
    const optedOut = contractOf(
      {
        id: idColumn,
        tags: { nativeType: 'text', codecId: 'pg/text@1', nullable: false, many: true },
      },
      [],
    );
    const { ops } = await migrate(optedOut, { from: enforced, policy: FULL_POLICY });

    const dropOps = ops.filter((op) => op.id.startsWith('dropCheckConstraint.'));
    expect(dropOps.map((op) => op.id)).toEqual([`dropCheckConstraint.Item.${tagsChecks[0]?.name}`]);
    expect(dropOps[0]?.operationClass).toBe('destructive');
    expect(ops).toHaveLength(1);

    expect(await liveCheckNames()).toEqual([]);
    expect((await verify(optedOut)).ok).toBe(true);
  });

  it('removing an opt-out installs the element check in one additive plan', {
    timeout: testTimeout,
  }, async () => {
    // Hand-built equivalent of the opted-out contract (no check declared).
    const optedOut = contractOf(
      {
        id: idColumn,
        tags: { nativeType: 'text', codecId: 'pg/text@1', nullable: false, many: true },
      },
      [],
    );
    await migrate(optedOut);
    expect(await liveCheckNames()).toEqual([]);
    await driver!.query(`INSERT INTO "Item" (id, tags) VALUES ('a', ARRAY['x',NULL])`);

    const tagsChecks = checksForColumn('Item', 'tags', { many: true });
    const enforced = contractOf(
      {
        id: idColumn,
        tags: { nativeType: 'text', codecId: 'pg/text@1', nullable: false, many: true },
      },
      tagsChecks,
    );
    // The seeded NULL-element row would fail the incoming check's validation
    // scan, so clear it first — this scenario pins the plan shape, not
    // pre-existing-data repair.
    await driver!.query(`DELETE FROM "Item"`);
    const { ops } = await migrate(enforced, { from: optedOut, policy: FULL_POLICY });

    const addOps = ops.filter((op) => op.id.startsWith('checkConstraint.'));
    expect(addOps.map((op) => op.id)).toEqual([`checkConstraint.Item.${tagsChecks[0]?.name}`]);
    expect(addOps[0]?.operationClass).toBe('additive');
    expect(ops).toHaveLength(1);

    expect(await liveCheckNames()).toEqual([tagsChecks[0]?.name]);
    expect((await verify(enforced)).ok).toBe(true);
    await expect(
      driver!.query(`INSERT INTO "Item" (id, tags) VALUES ('b', ARRAY['x',NULL])`),
    ).rejects.toThrow(/Item_tags/);
  });

  // Drives the real authoring surface end to end: defineContract with
  // `.many().noCheck('elementNotNull')` builds the contract, so the
  // builder's opt-out — not a hand-assembled shape — is what reaches the
  // planner and the database.
  it('a freshly created table with an opted-out column genuinely lacks enforcement', {
    timeout: testTimeout,
  }, async () => {
    const optedOut = defineContract(
      {
        family: authoringFamilyPack,
        target: authoringTargetPack,
        createNamespace: postgresCreateNamespace,
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            Item: m('Item', {
              fields: { id: f.text().id(), tags: f.text().many().noCheck('elementNotNull') },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const itemTable = optedOut.storage.namespaces['public']?.entries.table?.['Item'] as
      | StorageTable
      | undefined;
    expect(itemTable?.columns['tags']?.noCheck).toEqual(['elementNotNull']);
    expect(itemTable?.checks ?? []).toEqual([]);

    await migrate(optedOut);

    expect(await liveCheckNames()).toEqual([]);
    expect((await verify(optedOut)).ok).toBe(true);
    // Enforcement is genuinely absent, not merely undeclared.
    await driver!.query(`INSERT INTO "Item" (id, tags) VALUES ('a', ARRAY['x',NULL])`);
    const rows = await driver!.query<{ id: string }>(`SELECT id FROM "Item"`);
    expect(rows.rows).toEqual([{ id: 'a' }]);
  });
});

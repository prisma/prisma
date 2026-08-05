import { type Contract, coreHash, profileHash } from '@internal/contract/types';
import { INIT_ADDITIVE_POLICY } from '@internal/family-sql/control';
import {
  APP_SPACE_ID,
  type MigrationOperationPolicy,
} from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { CheckConstraint, SqlStorage, type StorageTable } from '@internal/sql-contract/types';
import { computeCheckContentHash } from '@internal/sql-schema-ir/naming';
import { postgresRenderCheckExpressions } from '@internal/target-postgres/check-expressions';
import {
  PostgresDatabaseSchemaNode,
  postgresCreateNamespace,
} from '@internal/target-postgres/types';
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
          prefix: candidate.prefix,
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
    return { opIds };
  }

  async function verify(contract: Contract<SqlStorage>, strict = true) {
    const schema = await familyInstance.introspect({ driver: driver!, contract });
    return familyInstance.verifySchema({ contract, schema, strict, frameworkComponents });
  }

  async function liveCheckNames(): Promise<readonly string[]> {
    const rows = await driver!.query<{ conname: string }>(
      `SELECT c.conname FROM pg_catalog.pg_constraint c
         JOIN pg_catalog.pg_class t ON t.oid = c.conrelid
         JOIN pg_catalog.pg_namespace n ON n.oid = t.relnamespace
        WHERE n.nspname = 'public' AND t.relname = 'Item' AND c.contype = 'c'
        ORDER BY c.conname`,
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
  // check's drop BEFORE the column's. `attrs` sorts before the literal
  // `check:` prefix, so without a dependency edge the lexicographic tiebreak
  // puts the column first and the constraint drop then fails its precheck.
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

    const membershipName = checks[0]?.name ?? '';
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

    await driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('a', ARRAY['user','admin'])`);
    await expect(
      driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('b', ARRAY['user','root'])`),
    ).rejects.toThrow(new RegExp(checks[0]?.name ?? ''));
    await expect(
      driver!.query(`INSERT INTO "Item" (id, roles) VALUES ('c', ARRAY['user',NULL])`),
    ).rejects.toThrow(/Item_roles/);

    expect((await verify(contract)).ok).toBe(true);
    expect((await verify(contract)).ok).toBe(true);
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
});

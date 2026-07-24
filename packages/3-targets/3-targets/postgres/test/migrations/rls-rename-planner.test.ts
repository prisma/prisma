/**
 * Rename post-pass: a `not-found` and a `not-expected` policy on the same
 * table whose wire-name content hashes match and prefixes differ collapse
 * into one non-destructive `ALTER POLICY … RENAME TO`. Multi-candidate hash
 * groups pair deterministically by sorted wire name; leftovers and
 * unparseable names proceed as create/drop; a content edit (same prefix,
 * different hash) never pairs. Renames plan without the destructive
 * allowance; under an additive-only policy the pairing degrades to a bare
 * create of the new name.
 */

import type { ControlPolicy } from '@prisma-next/contract/types';
import { type Contract, coreHash, profileHash } from '@prisma-next/contract/types';
import type { ExecuteRequestLowerer } from '@prisma-next/family-sql/control-adapter';
import type { MigrationOperationClass } from '@prisma-next/framework-components/control';
import { APP_SPACE_ID } from '@prisma-next/framework-components/control';
import { SqlStorage, StorageTable } from '@prisma-next/sql-contract/types';
import { applicationDomainOf } from '@prisma-next/test-utils';
import { describe, expect, it } from 'vitest';
import { createPostgresMigrationPlanner } from '../../src/core/migrations/planner';
import { PostgresRlsEnablement } from '../../src/core/postgres-rls-enablement';
import { PostgresRlsPolicy } from '../../src/core/postgres-rls-policy';
import { PostgresSchema } from '../../src/core/postgres-schema';
import { PostgresDatabaseSchemaNode } from '../../src/core/schema-ir/postgres-database-schema-node';
import { PostgresNamespaceSchemaNode } from '../../src/core/schema-ir/postgres-namespace-schema-node';
import { PostgresPolicySchemaNode } from '../../src/core/schema-ir/postgres-policy-schema-node';
import { PostgresTableSchemaNode } from '../../src/core/schema-ir/postgres-table-schema-node';

const TABLE_NAME = 'profiles';
const stubLowerer: ExecuteRequestLowerer = {
  lower: () => ({ sql: 'stub', params: [] }),
  lowerToExecuteRequest: async () => ({ sql: 'stub', params: [] }),
};

const ALL_CLASSES_POLICY = {
  allowedOperationClasses: ['additive', 'widening', 'destructive'] as const,
};
const NO_DESTRUCTIVE_POLICY = { allowedOperationClasses: ['additive', 'widening'] as const };
const ADDITIVE_ONLY_POLICY = { allowedOperationClasses: ['additive'] as const };

function policyNamed(name: string): PostgresRlsPolicy {
  const prefix = /_[0-9a-f]{8}$/.test(name) ? name.replace(/_[0-9a-f]{8}$/, '') : undefined;
  return new PostgresRlsPolicy({
    name,
    ...(prefix !== undefined ? { prefix } : {}),
    tableName: TABLE_NAME,
    namespaceId: 'public',
    operation: 'select',
    roles: ['authenticated'],
    using: '(auth.uid() = user_id)',
    permissive: true,
  });
}

function buildContract(
  policies: readonly PostgresRlsPolicy[],
  options?: { readonly control?: ControlPolicy },
): Contract<SqlStorage> {
  const policyEntries: Record<string, PostgresRlsPolicy> = {};
  for (const policy of policies) {
    policyEntries[policy.name] = policy;
  }
  const schema = new PostgresSchema({
    id: 'public',
    entries: {
      table: {
        [TABLE_NAME]: new StorageTable({
          columns: {
            id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
            user_id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
          },
          primaryKey: { columns: ['id'] },
          foreignKeys: [],
          uniques: [],
          indexes: [],
          ...(options?.control !== undefined ? { control: options.control } : {}),
        }),
      },
      policy: policyEntries,
      rls: {
        [TABLE_NAME]: new PostgresRlsEnablement({ tableName: TABLE_NAME, namespaceId: 'public' }),
      },
    },
  });
  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash('rls-rename-planner-test'),
    storage: new SqlStorage({
      storageHash: coreHash('rls-rename-planner-test'),
      namespaces: { public: schema },
    }),
    roots: {},
    domain: applicationDomainOf({ models: {} }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

function actualSchema(policies: readonly PostgresRlsPolicy[]): PostgresDatabaseSchemaNode {
  return new PostgresDatabaseSchemaNode({
    namespaces: {
      public: new PostgresNamespaceSchemaNode({
        schemaName: 'public',
        tables: {
          [TABLE_NAME]: new PostgresTableSchemaNode({
            name: TABLE_NAME,
            columns: {
              id: { name: 'id', nativeType: 'int4', nullable: false },
              user_id: { name: 'user_id', nativeType: 'int4', nullable: false },
            },
            primaryKey: { columns: ['id'] },
            foreignKeys: [],
            uniques: [],
            indexes: [],
            rlsEnabled: true,
            policies: policies.map(
              (policy) =>
                new PostgresPolicySchemaNode({
                  name: policy.name,
                  ...(policy.prefix !== undefined ? { prefix: policy.prefix } : {}),
                  tableName: policy.tableName,
                  namespaceId: 'public',
                  operation: policy.operation,
                  roles: [...policy.roles],
                  ...(policy.using !== undefined ? { using: policy.using } : {}),
                  permissive: policy.permissive,
                }),
            ),
          }),
        },
      }),
    },
    roles: [],
    existingSchemas: ['public'],
    pgVersion: 'unknown',
  });
}

async function planOpIds(
  contract: Contract<SqlStorage>,
  schema: PostgresDatabaseSchemaNode,
  policy: { readonly allowedOperationClasses: readonly MigrationOperationClass[] },
): Promise<readonly string[]> {
  const planner = createPostgresMigrationPlanner(stubLowerer);
  const result = planner.plan({
    contract,
    schema,
    policy: { allowedOperationClasses: [...policy.allowedOperationClasses] },
    fromContract: null,
    frameworkComponents: [],
    spaceId: APP_SPACE_ID,
    snapshotsImportPath: '../../snapshots',
  });
  expect(result.kind).toBe('success');
  if (result.kind !== 'success') return [];
  const ops = await Promise.all(result.plan.operations);
  return ops.map((op) => op.id);
}

describe('prefix-only rename pairing', () => {
  it('plans exactly one ALTER POLICY … RENAME TO — no drop, no create', async () => {
    const contract = buildContract([policyNamed('owner_read_ab12cd34')]);
    const schema = actualSchema([policyNamed('p_read_ab12cd34')]);

    const opIds = await planOpIds(contract, schema, ALL_CLASSES_POLICY);
    expect(opIds).toEqual([`rlsPolicy.public.${TABLE_NAME}.p_read_ab12cd34.rename`]);
  });

  it('plans the rename without the destructive allowance', async () => {
    const contract = buildContract([policyNamed('owner_read_ab12cd34')]);
    const schema = actualSchema([policyNamed('p_read_ab12cd34')]);

    const opIds = await planOpIds(contract, schema, NO_DESTRUCTIVE_POLICY);
    expect(opIds).toEqual([`rlsPolicy.public.${TABLE_NAME}.p_read_ab12cd34.rename`]);
  });

  it('degrades to a bare create of the new name under an additive-only policy', async () => {
    // Rename is a widening-class op; under additive-only the pairing does
    // not run (emitting the rename would only fail the runner's class
    // re-enforcement), so the additive half proceeds alone: the new name is
    // created and the old policy survives live until a widening-allowed
    // plan pairs — or a destructive-allowed plan drops — it.
    const contract = buildContract([policyNamed('owner_read_ab12cd34')]);
    const schema = actualSchema([policyNamed('p_read_ab12cd34')]);

    const opIds = await planOpIds(contract, schema, ADDITIVE_ONLY_POLICY);
    expect(opIds).toEqual([`rlsPolicy.public.${TABLE_NAME}.owner_read_ab12cd34`]);
  });

  it('never pairs a content edit: same prefix, different hash stays create + drop', async () => {
    const contract = buildContract([policyNamed('p_read_11111111')]);
    const schema = actualSchema([policyNamed('p_read_00000000')]);

    const opIds = await planOpIds(contract, schema, ALL_CLASSES_POLICY);
    expect(opIds).toEqual([
      `rlsPolicy.public.${TABLE_NAME}.p_read_11111111`,
      `rlsPolicy.public.${TABLE_NAME}.p_read_00000000.drop`,
    ]);
  });

  it('never pairs an unparseable live policy name', async () => {
    const contract = buildContract([policyNamed('p_read_ab12cd34')]);
    const schema = actualSchema([policyNamed('handwritten_policy')]);

    const opIds = await planOpIds(contract, schema, ALL_CLASSES_POLICY);
    expect(opIds).toEqual([
      `rlsPolicy.public.${TABLE_NAME}.p_read_ab12cd34`,
      `rlsPolicy.public.${TABLE_NAME}.handwritten_policy.drop`,
    ]);
  });
});

describe('multi-candidate hash groups', () => {
  it('pairs deterministically by sorted wire name', async () => {
    const contract = buildContract([
      policyNamed('alpha_read_ab12cd34'),
      policyNamed('beta_read_ab12cd34'),
    ]);
    const schema = actualSchema([
      policyNamed('delta_read_ab12cd34'),
      policyNamed('gamma_read_ab12cd34'),
    ]);

    const opIds = await planOpIds(contract, schema, ALL_CLASSES_POLICY);
    expect(opIds).toEqual([
      `rlsPolicy.public.${TABLE_NAME}.delta_read_ab12cd34.rename`,
      `rlsPolicy.public.${TABLE_NAME}.gamma_read_ab12cd34.rename`,
    ]);
  });

  it('leftover extras beyond the pairable set proceed as drops', async () => {
    const contract = buildContract([policyNamed('alpha_read_ab12cd34')]);
    const schema = actualSchema([
      policyNamed('delta_read_ab12cd34'),
      policyNamed('gamma_read_ab12cd34'),
    ]);

    const opIds = await planOpIds(contract, schema, ALL_CLASSES_POLICY);
    expect(opIds).toEqual([
      `rlsPolicy.public.${TABLE_NAME}.delta_read_ab12cd34.rename`,
      `rlsPolicy.public.${TABLE_NAME}.gamma_read_ab12cd34.drop`,
    ]);
  });
});

describe('external-table grading', () => {
  it('suppresses the rename on an external table, surfacing a warning', async () => {
    const contract = buildContract([policyNamed('owner_read_ab12cd34')], { control: 'external' });
    const schema = actualSchema([policyNamed('p_read_ab12cd34')]);

    const planner = createPostgresMigrationPlanner(stubLowerer);
    const result = planner.plan({
      contract,
      schema,
      policy: { allowedOperationClasses: ['additive', 'widening', 'destructive'] as const },
      fromContract: null,
      frameworkComponents: [],
      spaceId: APP_SPACE_ID,
      snapshotsImportPath: '../../snapshots',
    });
    expect(result.kind).toBe('success');
    if (result.kind !== 'success') return;
    const ops = await Promise.all(result.plan.operations);
    expect(ops).toEqual([]);
    expect(result.warnings ?? []).not.toEqual([]);
  });
});

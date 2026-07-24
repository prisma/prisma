/**
 * Policy and `@@rls` emission (D8 policy half): every introspected policy
 * emits a `policy_<operation>` block with `@@map` ALWAYS (a body reprint
 * never re-hashes reliably, so every adopted policy is exact), sanitized
 * disambiguated heads, verbatim bodies, roles as-is, and `permissive =
 * false` for RESTRICTIVE rows; `@@rls` emits natively on models whose
 * table carries `rlsEnabled`. An unauthorable policy (a role name outside
 * the PSL identifier grammar) skips with a comment note on its target
 * model instead of failing the whole infer.
 */
import { printPsl } from '@prisma-next/psl-printer';
import { describe, expect, it } from 'vitest';
import { postgresAuthoringPslBlockDescriptors } from '../../src/core/authoring';
import { inferPostgresPslContract } from '../../src/core/psl-infer/infer-psl-contract';
import { PostgresDatabaseSchemaNode } from '../../src/core/schema-ir/postgres-database-schema-node';
import { PostgresNamespaceSchemaNode } from '../../src/core/schema-ir/postgres-namespace-schema-node';
import { PostgresPolicySchemaNode } from '../../src/core/schema-ir/postgres-policy-schema-node';
import { PostgresTableSchemaNode } from '../../src/core/schema-ir/postgres-table-schema-node';

interface PolicyFixture {
  readonly name: string;
  readonly prefix?: string;
  readonly operation?: 'select' | 'insert' | 'update' | 'delete' | 'all';
  readonly roles?: readonly string[];
  readonly using?: string;
  readonly withCheck?: string;
  readonly permissive?: boolean;
}

function policyNode(fixture: PolicyFixture): PostgresPolicySchemaNode {
  return new PostgresPolicySchemaNode({
    name: fixture.name,
    ...(fixture.prefix !== undefined ? { prefix: fixture.prefix } : {}),
    tableName: 'profile',
    namespaceId: 'public',
    operation: fixture.operation ?? 'select',
    roles: [...(fixture.roles ?? ['app_user'])],
    ...(fixture.using !== undefined ? { using: fixture.using } : {}),
    ...(fixture.withCheck !== undefined ? { withCheck: fixture.withCheck } : {}),
    permissive: fixture.permissive ?? true,
  });
}

function pslWithPolicies(policies: readonly PostgresPolicySchemaNode[], rlsEnabled = true): string {
  const tree = new PostgresDatabaseSchemaNode({
    namespaces: {
      public: new PostgresNamespaceSchemaNode({
        schemaName: 'public',
        tables: {
          profile: new PostgresTableSchemaNode({
            name: 'profile',
            columns: {
              id: { name: 'id', nativeType: 'int4', nullable: false },
              owner_id: { name: 'owner_id', nativeType: 'int4', nullable: false },
            },
            primaryKey: { columns: ['id'] },
            foreignKeys: [],
            uniques: [],
            indexes: [],
            policies: [...policies],
            rlsEnabled,
          }),
        },
      }),
    },
    roles: [],
    existingSchemas: ['public'],
    pgVersion: '',
  });
  return printPsl(inferPostgresPslContract(tree), {
    pslBlockDescriptors: postgresAuthoringPslBlockDescriptors,
  });
}

describe('@@rls emission', () => {
  it('a model backed by an rlsEnabled table carries @@rls', () => {
    const psl = pslWithPolicies([]);
    expect(psl).toContain('@@rls');
  });

  it('an RLS-disabled table emits no @@rls', () => {
    const psl = pslWithPolicies([], false);
    expect(psl).not.toContain('@@rls');
  });
});

describe('policy block emission', () => {
  it('a wire-named policy emits its parsed prefix as the head, @@map always', () => {
    const psl = pslWithPolicies([
      policyNode({ name: 'p_read_ab12cd34', prefix: 'p_read', using: '(owner_id = 1)' }),
    ]);
    expect(psl).toContain('policy_select p_read {');
    expect(psl).toContain('target = Profile');
    expect(psl).toContain('roles = [app_user]');
    expect(psl).toContain('using = "(owner_id = 1)"');
    expect(psl).toContain('@@map("p_read_ab12cd34")');
    expect(psl).not.toContain('permissive');
  });

  it('policy-bearing output wraps in the namespace block', () => {
    const psl = pslWithPolicies([
      policyNode({ name: 'p_read_ab12cd34', prefix: 'p_read', using: '(owner_id = 1)' }),
    ]);
    expect(psl).toContain('namespace public {');
  });

  it('a RESTRICTIVE policy emits permissive = false', () => {
    const psl = pslWithPolicies([
      policyNode({
        name: 'p_block_all',
        using: '(owner_id = 1)',
        permissive: false,
      }),
    ]);
    expect(psl).toContain('permissive = false');
  });

  it('withCheck and multi-role lists emit as introspected', () => {
    const psl = pslWithPolicies([
      policyNode({
        name: 'p_write_ab12cd34',
        prefix: 'p_write',
        operation: 'update',
        roles: ['app_user', 'auditor'],
        using: '(owner_id = 1)',
        withCheck: '(owner_id = 2)',
      }),
    ]);
    expect(psl).toContain('policy_update p_write {');
    expect(psl).toContain('roles = [app_user, auditor]');
    expect(psl).toContain('using = "(owner_id = 1)"');
    expect(psl).toContain('withCheck = "(owner_id = 2)"');
  });

  it('a non-wire physical name sanitizes into the head with @@map carrying the truth', () => {
    const psl = pslWithPolicies([
      policyNode({ name: 'Tenant members can read', using: '(owner_id = 1)' }),
    ]);
    expect(psl).toContain('policy_select Tenant_members_can_read {');
    expect(psl).toContain('@@map("Tenant members can read")');
  });

  it('a head starting with an invalid character gains a leading underscore', () => {
    const psl = pslWithPolicies([policyNode({ name: '2fast policy', using: '(owner_id = 1)' })]);
    expect(psl).toContain('policy_select _2fast_policy {');
  });

  it('within-namespace head collisions disambiguate numerically by sorted physical name', () => {
    const psl = pslWithPolicies([
      policyNode({ name: 'tenant read', using: '(owner_id = 1)' }),
      policyNode({ name: 'tenant.read', operation: 'update', using: '(owner_id = 2)' }),
    ]);
    // Sorted physical names: 'tenant read' < 'tenant.read'; both sanitize to
    // tenant_read, so the second takes the numeric suffix.
    expect(psl).toContain('policy_select tenant_read {');
    expect(psl).toContain('policy_update tenant_read_2 {');
    expect(psl).toContain('@@map("tenant read")');
    expect(psl).toContain('@@map("tenant.read")');
  });

  it('an unauthorable policy (ungrammatical role name) skips with a model comment note', () => {
    const psl = pslWithPolicies([
      policyNode({ name: 'odd role policy', roles: ['my role'], using: '(owner_id = 1)' }),
    ]);
    expect(psl).not.toContain('policy_select');
    expect(psl).toContain('// prisma-next: skipped policy "odd role policy"');
    expect(psl).toContain('@@rls');
  });
});

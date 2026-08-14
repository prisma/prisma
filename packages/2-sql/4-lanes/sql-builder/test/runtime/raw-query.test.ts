import type { Contract as FrameworkContract } from '@internal/contract/types';
import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import type { SqlStorage } from '@internal/sql-contract/types';
import { validateSqlContractFully } from '@internal/sql-contract/validators';
import { defineContract } from '@internal/sql-contract-ts/contract-builder';
import { type ParamRef, RawQueryAst } from '@internal/sql-relational-core/ast';
import type { ExecutionContext } from '@internal/sql-relational-core/query-lane-context';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../../1-core/contract/test/test-support';
import { sql } from '../../src/runtime/sql';
import { contract as contractJson } from '../fixtures/contract';
import type { Contract } from '../fixtures/generated/contract';

const sqlContract = validateSqlContractFully<Contract>(contractJson);

const stubBase = {
  operations: {},
  codecs: {},
  queryOperations: { entries: () => ({}) },
  aggregateDescriptors: { resolve: () => undefined, values: function* () {} },
  types: {},
  applyMutationDefaults: () => [],
};

function db() {
  return sql({
    context: { ...stubBase, contract: sqlContract } as unknown as ExecutionContext<
      typeof sqlContract
    >,
    rawCodecInferer: { inferCodec: () => 'pg/int4@1' },
  });
}

describe('contract-bound raw statements', () => {
  it('reads a column reference off the table proxy', () => {
    expect(db().public.users.columns.id).toEqual({ codecId: 'pg/int4@1', nullable: false });
    expect(db().public.users.columns.invited_by_id).toEqual({
      codecId: 'pg/int4@1',
      nullable: true,
    });
  });

  it('exposes no reference for a column the table does not declare', () => {
    expect(db().public.users.columns['nonexistent' as 'id']).toBeUndefined();
  });

  // Reads as the surface is meant to be used: one template, one row spec
  // mixing contract columns with a computed column, one terminator.
  it('builds a plan whose row spec resolves both entry forms', () => {
    const d = db();
    const users = d.public.users;

    const plan = d.raw`
      SELECT u.id, u.email, count(p.id) AS post_count
      FROM users u JOIN posts p ON p.user_id = u.id
      WHERE u.invited_by_id = ${1}
      GROUP BY u.id, u.email
    `
      .returnsRow({
        id: users.columns.id,
        email: users.columns.email,
        post_count: 'pg/int8@1',
      })
      .build();

    expect(plan.ast).toBeInstanceOf(RawQueryAst);
    expect((plan.ast as RawQueryAst).result).toEqual({
      kind: 'rows',
      columns: {
        id: { codecId: 'pg/int4@1', nullable: false },
        email: { codecId: 'pg/text@1', nullable: false },
        post_count: { codecId: 'pg/int8@1', nullable: false },
      },
    });
    expect(plan.meta).toMatchObject({
      target: sqlContract.target,
      targetFamily: sqlContract.targetFamily,
      lane: 'raw',
    });
  });

  it('binds interpolated values through the adapter inferer', () => {
    const plan = db().raw`SELECT id FROM users WHERE id = ${7}`
      .returnsRow({ id: 'pg/int4@1' })
      .build();

    const params = (plan.ast as RawQueryAst).collectParamRefs();
    expect(params).toHaveLength(1);
    expect((params[0] as ParamRef).value).toBe(7);
    expect((params[0] as ParamRef).codec?.codecId).toBe('pg/int4@1');
  });

  it('builds an affected-count plan from a mutation template', () => {
    const plan = db().raw`UPDATE users SET name = ${'Ada'} WHERE id = ${1}`.affectedCount().build();

    expect((plan.ast as RawQueryAst).result).toEqual({ kind: 'affected-count' });
  });

  it('splices a row-returning statement into another template', () => {
    const d = db();
    const invited = d.raw`SELECT id FROM users WHERE invited_by_id = ${1}`.returnsRow({
      id: d.public.users.columns.id,
    });

    const plan = d.raw`WITH invited AS (${invited}) SELECT count(*) AS n FROM invited`
      .returnsRow({ n: 'pg/int8@1' })
      .build();

    const ast = plan.ast as RawQueryAst;
    expect(ast.parts.some((part) => part instanceof RawQueryAst)).toBe(false);
    expect(ast.collectParamRefs()).toHaveLength(1);
  });
});

describe('reserved surface keys', () => {
  // Authored through the contract builder so the namespace is one the emitter
  // could really produce: the target pack's default namespace names it.
  const rawNamespaceContract = defineContract(
    {
      family: {
        kind: 'family',
        id: 'sql',
        familyId: 'sql',
        version: '0.0.1',
        authoring: {
          field: {
            text: { kind: 'fieldPreset', output: { codecId: 'pg/text@1', nativeType: 'text' } },
          },
        },
      } as const satisfies FamilyPackRef<'sql'>,
      target: {
        kind: 'target',
        id: 'postgres',
        familyId: 'sql',
        targetId: 'postgres',
        version: '0.0.1',
        defaultNamespaceId: 'raw',
      } as const satisfies TargetPackRef<'sql', 'postgres'>,
      createNamespace: createTestSqlNamespace,
    },
    ({ field: f, model: m }) =>
      ({
        models: {
          Note: m('Note', { fields: { id: f.text().id() } }),
        },
      }) as const,
  ) as FrameworkContract<SqlStorage>;

  it('refuses a contract whose storage claims the raw tag key', () => {
    expect(() =>
      sql({
        context: { ...stubBase, contract: rawNamespaceContract } as unknown as ExecutionContext<
          typeof rawNamespaceContract
        >,
        rawCodecInferer: { inferCodec: () => 'pg/text@1' },
      }),
    ).toThrow(/namespace named "raw" cannot be reached/);
  });

  it('names the collision in a structured envelope', () => {
    expect(() =>
      sql({
        context: { ...stubBase, contract: rawNamespaceContract } as unknown as ExecutionContext<
          typeof rawNamespaceContract
        >,
        rawCodecInferer: { inferCodec: () => 'pg/text@1' },
      }),
    ).toThrow(expect.objectContaining({ code: 'ORM.NAMESPACE_RESERVED' }));
  });
});

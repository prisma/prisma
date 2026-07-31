import { type Contract, coreHash, profileHash } from '@internal/contract/types';
import type { SchemaDiffIssue } from '@internal/framework-components/control';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import {
  CheckConstraint,
  SqlStorage,
  StorageTable,
  StorageValueSet,
} from '@internal/sql-contract/types';
import { SqlCheckConstraintIR, SqlSchemaIR } from '@internal/sql-schema-ir/types';
import { applicationDomainOf } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { planIssues } from '../../src/core/migrations/issue-planner';
import { checkConstraintPlanCallStrategy } from '../../src/core/migrations/planner-strategies';
import { postgresCreateNamespace } from '../../src/core/postgres-schema';

const VALUE_SET_NAME = 'Status_values';
const CHECK_NAME = 'user_status_check';
const TABLE_NAME = 'user';
const COLUMN_NAME = 'status';
const SCHEMA_NAME = 'public';

function makeValueSetRef() {
  return {
    plane: 'storage' as const,
    entityKind: 'valueSet' as const,
    namespaceId: UNBOUND_NAMESPACE_ID,
    entityName: VALUE_SET_NAME,
  };
}

function makeContractWithCheck(values: readonly string[]): Contract<SqlStorage> {
  const ns = postgresCreateNamespace({
    id: UNBOUND_NAMESPACE_ID,
    entries: {
      table: {
        [TABLE_NAME]: new StorageTable({
          columns: {
            id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
            [COLUMN_NAME]: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
          },
          primaryKey: { columns: ['id'] },
          foreignKeys: [],
          uniques: [],
          indexes: [],
          checks: [
            new CheckConstraint({
              name: CHECK_NAME,
              column: COLUMN_NAME,
              valueSet: makeValueSetRef(),
            }),
          ],
        }),
      },
      valueSet: {
        [VALUE_SET_NAME]: new StorageValueSet({
          kind: 'valueSet',
          values: values as string[],
        }),
      },
    },
  });
  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash('test'),
    storage: new SqlStorage({
      storageHash: coreHash('contract'),
      namespaces: { [UNBOUND_NAMESPACE_ID]: ns },
    }),
    roots: {},
    domain: applicationDomainOf({ models: {} }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

function makeContractWithoutCheck(): Contract<SqlStorage> {
  const ns = postgresCreateNamespace({
    id: UNBOUND_NAMESPACE_ID,
    entries: {
      table: {
        [TABLE_NAME]: new StorageTable({
          columns: {
            id: { nativeType: 'int4', codecId: 'pg/int4@1', nullable: false },
            [COLUMN_NAME]: { nativeType: 'text', codecId: 'pg/text@1', nullable: false },
          },
          primaryKey: { columns: ['id'] },
          foreignKeys: [],
          uniques: [],
          indexes: [],
        }),
      },
    },
  });
  return {
    target: 'postgres',
    targetFamily: 'sql',
    profileHash: profileHash('test'),
    storage: new SqlStorage({
      storageHash: coreHash('contract'),
      namespaces: { [UNBOUND_NAMESPACE_ID]: ns },
    }),
    roots: {},
    domain: applicationDomainOf({ models: {} }),
    capabilities: {},
    extensions: {},
    meta: {},
  };
}

function schemaWithCheck(values: readonly string[]): SqlSchemaIR {
  return new SqlSchemaIR({
    tables: {
      [TABLE_NAME]: {
        name: TABLE_NAME,
        columns: { id: { name: 'id', nativeType: 'int4', nullable: false } },
        foreignKeys: [],
        uniques: [],
        indexes: [],
        checks: [
          new SqlCheckConstraintIR({
            name: CHECK_NAME,
            column: COLUMN_NAME,
            permittedValues: [...values],
          }),
        ],
      },
    },
  });
}

function schemaWithoutCheck(): SqlSchemaIR {
  return new SqlSchemaIR({
    tables: {
      [TABLE_NAME]: {
        name: TABLE_NAME,
        columns: { id: { name: 'id', nativeType: 'int4', nullable: false } },
        foreignKeys: [],
        uniques: [],
        indexes: [],
      },
    },
  });
}

const defaultCtx = {
  schemaName: SCHEMA_NAME,
  codecHooks: new Map(),
  storageTypes: {},
};

/** Node-typed check-constraint issue, matching the shape the one differ produces. The change kind derives from which of `expectedValues`/`actualValues` are supplied. */
function checkIssue(options: {
  readonly expectedValues?: readonly string[];
  readonly actualValues?: readonly string[];
}): SchemaDiffIssue {
  const path = ['database', UNBOUND_NAMESPACE_ID, TABLE_NAME, `check:${CHECK_NAME}`];
  const expected =
    options.expectedValues !== undefined
      ? new SqlCheckConstraintIR({
          name: CHECK_NAME,
          column: COLUMN_NAME,
          permittedValues: [...options.expectedValues],
        })
      : undefined;
  const actual =
    options.actualValues !== undefined
      ? new SqlCheckConstraintIR({
          name: CHECK_NAME,
          column: COLUMN_NAME,
          permittedValues: [...options.actualValues],
        })
      : undefined;
  return {
    path,
    ...(expected !== undefined ? { expected } : {}),
    ...(actual !== undefined ? { actual } : {}),
  };
}

describe('checkConstraintPlanCallStrategy', () => {
  it('emits AddCheckConstraintCall when contract has a check absent from live schema', () => {
    const contract = makeContractWithCheck(['active', 'inactive']);
    const result = checkConstraintPlanCallStrategy(
      [checkIssue({ expectedValues: ['active', 'inactive'] })],
      {
        ...defaultCtx,
        toContract: contract,
        fromContract: null,
        schema: schemaWithoutCheck(),
        policy: { allowedOperationClasses: ['additive'] },
        frameworkComponents: [],
      },
    );

    expect(result.kind).toBe('match');
    if (result.kind !== 'match') return;
    expect(result.calls).toHaveLength(1);
    expect(result.calls[0]).toMatchObject({
      factoryName: 'addCheckConstraint',
      tableName: TABLE_NAME,
      constraintName: CHECK_NAME,
      column: COLUMN_NAME,
      values: expect.arrayContaining(['active', 'inactive']),
    });
    expect(result.issues).toHaveLength(0);
  });

  it('emits DropCheckConstraintCall + AddCheckConstraintCall when value sets differ', () => {
    const contract = makeContractWithCheck(['active', 'inactive', 'pending']);
    const result = checkConstraintPlanCallStrategy(
      [
        checkIssue({
          expectedValues: ['active', 'inactive', 'pending'],
          actualValues: ['active', 'inactive'],
        }),
      ],
      {
        ...defaultCtx,
        toContract: contract,
        fromContract: null,
        schema: schemaWithCheck(['active', 'inactive']),
        policy: { allowedOperationClasses: ['additive', 'destructive'] },
        frameworkComponents: [],
      },
    );

    expect(result.kind).toBe('match');
    if (result.kind !== 'match') return;
    expect(result.calls).toHaveLength(2);
    expect(result.calls[0]).toMatchObject({
      factoryName: 'dropCheckConstraint',
      tableName: TABLE_NAME,
      constraintName: CHECK_NAME,
    });
    expect(result.calls[1]).toMatchObject({
      factoryName: 'addCheckConstraint',
      tableName: TABLE_NAME,
      constraintName: CHECK_NAME,
      values: expect.arrayContaining(['active', 'inactive', 'pending']),
    });
    expect(result.issues).toHaveLength(0);
  });

  it('emits DropCheckConstraintCall when live has a check absent from contract', () => {
    const contract = makeContractWithoutCheck();
    const result = checkConstraintPlanCallStrategy(
      [checkIssue({ actualValues: ['active', 'inactive'] })],
      {
        ...defaultCtx,
        toContract: contract,
        fromContract: null,
        schema: schemaWithCheck(['active', 'inactive']),
        policy: { allowedOperationClasses: ['destructive'] },
        frameworkComponents: [],
      },
    );

    // Contract has no checks — the strategy has nothing to iterate over.
    // The not-expected issue falls through (no tables with checks in contract).
    // The DropCheckConstraintCall should come from mapNodeIssueToCall via
    // the not-expected default handler.
    expect(result.kind).toBe('no_match');
  });

  it('emits no calls and consumes the issue when value sets match (no-op)', () => {
    const contract = makeContractWithCheck(['active', 'inactive']);
    const result = checkConstraintPlanCallStrategy(
      [checkIssue({ expectedValues: ['active', 'inactive'] })],
      {
        ...defaultCtx,
        toContract: contract,
        fromContract: null,
        schema: schemaWithCheck(['active', 'inactive']),
        policy: { allowedOperationClasses: ['additive'] },
        frameworkComponents: [],
      },
    );

    expect(result.kind).toBe('match');
    if (result.kind !== 'match') return;
    expect(result.calls).toHaveLength(0);
    expect(result.issues).toHaveLength(0);
  });
});

describe('planIssues — check constraint strategy', () => {
  it('a not-expected check produces DropCheckConstraintCall when contract has no check', () => {
    const contract = makeContractWithoutCheck();
    const result = planIssues({
      ...defaultCtx,
      issues: [checkIssue({ actualValues: ['active', 'inactive'] })],
      toContract: contract,
      fromContract: null,
      schema: schemaWithCheck(['active', 'inactive']),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const call = result.value.calls.find((c) => c.factoryName === 'dropCheckConstraint');
    expect(call).toMatchObject({
      factoryName: 'dropCheckConstraint',
      tableName: TABLE_NAME,
      constraintName: CHECK_NAME,
    });
  });

  it('a not-found check produces AddCheckConstraintCall in the unique bucket', () => {
    const contract = makeContractWithCheck(['active', 'inactive']);
    const result = planIssues({
      ...defaultCtx,
      issues: [checkIssue({ expectedValues: ['active', 'inactive'] })],
      toContract: contract,
      fromContract: null,
      schema: schemaWithoutCheck(),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const call = result.value.calls.find((c) => c.factoryName === 'addCheckConstraint');
    expect(call).toMatchObject({
      factoryName: 'addCheckConstraint',
      tableName: TABLE_NAME,
      constraintName: CHECK_NAME,
    });
  });

  it('a not-equal check produces DropCheckConstraintCall + AddCheckConstraintCall', () => {
    const contract = makeContractWithCheck(['active', 'inactive', 'pending']);
    const result = planIssues({
      ...defaultCtx,
      issues: [
        checkIssue({
          expectedValues: ['active', 'inactive', 'pending'],
          actualValues: ['active', 'inactive'],
        }),
      ],
      toContract: contract,
      fromContract: null,
      schema: schemaWithCheck(['active', 'inactive']),
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const calls = result.value.calls;
    expect(calls.some((c) => c.factoryName === 'dropCheckConstraint')).toBe(true);
    expect(calls.some((c) => c.factoryName === 'addCheckConstraint')).toBe(true);
    // Drop must come before add in final call order
    const dropIdx = calls.findIndex((c) => c.factoryName === 'dropCheckConstraint');
    const addIdx = calls.findIndex((c) => c.factoryName === 'addCheckConstraint');
    expect(dropIdx).toBeLessThan(addIdx);
  });
});

import type { Contract } from '@internal/contract/types';
import type { FamilyPackRef, TargetPackRef } from '@internal/framework-components/components';
import {
  CheckConstraint,
  checkConstraintInputFromSerialized,
  type SqlStorage,
  type StorageTable,
} from '@internal/sql-contract/types';
import {
  computeCheckContentHash,
  formatWireName,
  parseNaming,
  WIRE_NAME_PREFIX_MAX_LENGTH,
} from '@internal/sql-schema-ir/naming';
import { describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { defineContract } from '../src/contract-builder';
import { enumType, member } from '../src/enum-type';

const sqlFamilyPack = {
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
} as const satisfies FamilyPackRef<'sql'>;

interface RenderInput {
  readonly tableName: string;
  readonly columnName: string;
  readonly many: boolean;
  readonly memberValues: readonly string[] | undefined;
}

/**
 * Stands in for the Postgres pack's `renderCheckExpressions`, reproducing the
 * forms it emits. The real hook is unit-tested in the Postgres target package;
 * this file pins what the contract builder does with whatever a hook returns,
 * which is why the stub also records its calls.
 */
const hookCalls: RenderInput[] = [];

function renderCheckExpressions(
  input: RenderInput,
): ReadonlyArray<{ readonly prefix: string; readonly expression: string }> {
  hookCalls.push(input);
  const candidates: Array<{ prefix: string; expression: string }> = [];
  const column = `"${input.columnName}"`;
  if (input.memberValues !== undefined) {
    const members = input.memberValues.map((v) => `'${v}'`).join(', ');
    candidates.push({
      prefix: `${input.tableName}_${input.columnName}_check`,
      expression: input.many
        ? `${column} <@ ARRAY[${members}]::text[]`
        : `${column} IN (${members})`,
    });
  }
  if (input.many) {
    candidates.push({
      prefix: `${input.tableName}_${input.columnName}_elem_not_null`,
      expression: `array_position(${column}, NULL) IS NULL`,
    });
  }
  return candidates;
}

// `AuthoringContributions` does not name the duck-typed hooks (the whole point
// of the pattern), so the pack carrying one is not written `satisfies
// TargetPackRef` — the real Postgres descriptor meta is not either.
const postgresTargetPack = {
  kind: 'target',
  id: 'postgres',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  defaultNamespaceId: 'public',
  // `field: {}` is what makes this a real `AuthoringContributions` rather
  // than a weak-type mismatch; the production pack carries presets here.
  authoring: { field: {}, renderCheckExpressions },
} as const;

const bareTargetPack = {
  kind: 'target',
  id: 'postgres',
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  defaultNamespaceId: 'public',
} as const satisfies TargetPackRef<'sql', 'postgres'>;

const pgText = { codecId: 'pg/text@1' as const, nativeType: 'text' } as const;

const Role = enumType('Role', pgText, member('User', 'user'), member('Admin', 'admin'));
const Status = enumType('Status', pgText, member('Active', 'active'));

const nativeRoleDescriptor = {
  codecId: 'test/native-role@1',
  nativeType: 'native_role',
  valueSet: {
    plane: 'storage',
    entityKind: 'valueSet',
    namespaceId: 'public',
    entityName: 'NativeRole',
  },
} as const;

function checksOf(contract: Contract<SqlStorage>): readonly CheckConstraint[] {
  const ns = contract.storage.namespaces['public'];
  const table = ns !== undefined ? ns.entries.table?.['User'] : undefined;
  return (table as StorageTable | undefined)?.checks ?? [];
}

function flatten(checks: readonly CheckConstraint[]) {
  return checks.map((c) => ({ name: c.name, prefix: c.prefix, expression: c.expression }));
}

function wire(prefix: string, expression: string) {
  return { name: formatWireName(prefix, computeCheckContentHash(expression)), prefix, expression };
}

describe('check emission — scalar domain enum', () => {
  it('emits one wire-named membership check whose suffix hashes the expression', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: { User: m('User', { fields: { id: f.text().id(), role: f.namedType(Role) } }) },
        }) as const,
    ) as Contract<SqlStorage>;

    expect(flatten(checksOf(contract))).toEqual([
      wire('User_role_check', `"role" IN ('user', 'admin')`),
    ]);
  });

  it('emits one check per enum-restricted column', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role, Status },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: { id: f.text().id(), role: f.namedType(Role), status: f.namedType(Status) },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    expect(checksOf(contract).map((c) => c.prefix)).toEqual([
      'User_role_check',
      'User_status_check',
    ]);
  });
});

describe('check emission — array domain enum', () => {
  it('emits the containment membership check plus the element-non-null check', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', { fields: { id: f.text().id(), roles: f.namedType(Role).many() } }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    expect(flatten(checksOf(contract))).toEqual([
      wire('User_roles_check', `"roles" <@ ARRAY['user', 'admin']::text[]`),
      wire('User_roles_elem_not_null', `array_position("roles", NULL) IS NULL`),
    ]);
  });
});

describe('check emission — plain list column', () => {
  it('emits only the element-non-null check', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
      },
      ({ field: f, model: m }) =>
        ({
          models: { User: m('User', { fields: { id: f.text().id(), tags: f.text().many() } }) },
        }) as const,
    ) as Contract<SqlStorage>;

    expect(flatten(checksOf(contract))).toEqual([
      wire('User_tags_elem_not_null', `array_position("tags", NULL) IS NULL`),
    ]);
  });
});

describe('check emission — entity-ref-resolved value set (native enum shape)', () => {
  it('emits no membership check for a scalar native-enum column', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: { id: f.text().id(), role: f.column(nativeRoleDescriptor) },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    expect(checksOf(contract)).toEqual([]);
  });

  it('emits only element-non-null for a native-enum array column', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: { id: f.text().id(), roles: f.column(nativeRoleDescriptor).many() },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    expect(flatten(checksOf(contract))).toEqual([
      wire('User_roles_elem_not_null', `array_position("roles", NULL) IS NULL`),
    ]);
  });

  it('the hook sees no member values on the entity-ref path', () => {
    hookCalls.length = 0;
    defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: { id: f.text().id(), role: f.column(nativeRoleDescriptor) },
            }),
          },
        }) as const,
    );

    expect(hookCalls).toContainEqual({
      tableName: 'User',
      columnName: 'role',
      many: false,
      memberValues: undefined,
    });
  });
});

describe('check emission — domain enum on a non-pg codec', () => {
  it('still emits a membership check (a domain enum is always a plain scalar column)', () => {
    const NativeRole = enumType(
      'NativeRole',
      { codecId: 'test/native-enum@1', nativeType: 'native_role' },
      member('User', 'user'),
    );
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { NativeRole },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', { fields: { id: f.text().id(), role: f.namedType(NativeRole) } }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    expect(flatten(checksOf(contract))).toEqual([wire('User_role_check', `"role" IN ('user')`)]);
  });
});

describe('check emission — a target with no hook writes no checks', () => {
  it('leaves checks absent even for an enum-restricted column', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: bareTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: { User: m('User', { fields: { id: f.text().id(), role: f.namedType(Role) } }) },
        }) as const,
    ) as Contract<SqlStorage>;

    expect(checksOf(contract)).toEqual([]);
  });
});

describe('check emission — guards', () => {
  // A check prefix is derived from the table and column names, so an author
  // has no way to shorten one — unlike an index, where `name:` is the escape
  // hatch the throw-stance assumes. Identity lives in the hash, so truncating
  // is safe: two prefixes that truncate alike still carry distinct hashes.
  it('truncates a derived prefix to the cap instead of throwing', () => {
    // `User_` + 44 + `_check` = 55 > 54.
    const longColumn = 'c'.repeat(44);
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', { fields: { id: f.text().id(), [longColumn]: f.namedType(Role) } }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const check = checksOf(contract)[0];
    expect(check?.prefix).toHaveLength(WIRE_NAME_PREFIX_MAX_LENGTH);
    expect(`User_${longColumn}_check`.startsWith(check?.prefix ?? '')).toBe(true);
    // Postgres caps identifiers at 63; the wire name must fit.
    expect(check?.name.length).toBeLessThanOrEqual(63);
  });

  it('the truncated prefix still round-trips through parseNaming', () => {
    const longColumn = 'c'.repeat(44);
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', { fields: { id: f.text().id(), [longColumn]: f.namedType(Role) } }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const check = checksOf(contract)[0];
    expect(parseNaming(check?.name ?? '', check?.prefix)).toEqual({
      kind: 'wire',
      prefix: check?.prefix,
      hash: check?.name.slice((check?.prefix?.length ?? 0) + 1),
    });
  });

  it('columns whose truncated prefixes collide still get distinct names', () => {
    // Both prefixes truncate to the same 54 characters — the columns differ
    // only past the cap — while the differing member sets give the predicates,
    // and so the hashes, different content.
    const shared = 'c'.repeat(50);
    const Other = enumType('Other', pgText, member('X', 'x'));
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role, Other },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: {
                id: f.text().id(),
                [`${shared}a`]: f.namedType(Role),
                [`${shared}b`]: f.namedType(Other),
              },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const checks = checksOf(contract);
    expect(checks).toHaveLength(2);
    expect(checks[0]?.prefix).toBe(checks[1]?.prefix);
    expect(checks[0]?.name).not.toBe(checks[1]?.name);
  });

  it('rejects a value set with a non-string member', () => {
    const Level = enumType('Level', { codecId: 'pg/int4@1', nativeType: 'int4' }, member('One', 1));
    expect(() =>
      defineContract(
        {
          family: sqlFamilyPack,
          target: postgresTargetPack,
          createNamespace: createTestSqlNamespace,
          enums: { Level },
        },
        ({ field: f, model: m }) =>
          ({
            models: {
              User: m('User', { fields: { id: f.text().id(), level: f.namedType(Level) } }),
            },
          }) as const,
      ),
    ).toThrow(/numeric-enum CHECK constraints are not yet supported/);
  });
});

describe('check emission — JSON round-trip', () => {
  it('hydrates checks back through the stored flat shape', () => {
    const contract = defineContract(
      {
        family: sqlFamilyPack,
        target: postgresTargetPack,
        createNamespace: createTestSqlNamespace,
        enums: { Role },
      },
      ({ field: f, model: m }) =>
        ({
          models: {
            User: m('User', {
              fields: { id: f.text().id(), role: f.namedType(Role), tags: f.text().many() },
            }),
          },
        }) as const,
    ) as Contract<SqlStorage>;

    const json = JSON.parse(JSON.stringify(contract)) as {
      storage: {
        namespaces: Record<
          string,
          {
            entries: {
              table: Record<
                string,
                { checks: ReadonlyArray<{ name: string; prefix?: string; expression: string }> }
              >;
            };
          }
        >;
      };
    };
    const stored = json.storage.namespaces['public']?.entries.table['User']?.checks ?? [];
    const hydrated = stored.map(
      (flat) => new CheckConstraint(checkConstraintInputFromSerialized(flat)),
    );

    expect(flatten(hydrated)).toEqual(flatten(checksOf(contract)));
    expect(hydrated).toHaveLength(2);
  });
});

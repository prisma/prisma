import type { Contract, ContractModelBase } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import { sqlEmission } from '../src/index';
import { createEmitterTestContract as createContract } from './create-emitter-test-contract';

const column = {
  id: { nativeType: 'uuid', codecId: 'pg/uuid@1', nullable: false },
  role: {
    nativeType: 'text',
    codecId: 'pg/text@1',
    nullable: false,
    valueSet: {
      namespaceId: UNBOUND_NAMESPACE_ID,
      entityKind: 'valueSet',
      entityName: 'Role',
    },
  },
  amount: {
    nativeType: 'numeric',
    codecId: 'pg/numeric@1',
    nullable: false,
    typeParams: { precision: 10, scale: 2 },
  },
  viaRef: { nativeType: 'numeric', codecId: 'pg/numeric@1', nullable: false, typeRef: 'money' },
  danglingRef: {
    nativeType: 'numeric',
    codecId: 'pg/numeric@1',
    nullable: false,
    typeRef: 'missing',
  },
} as const;

function contractWith(parts: {
  readonly storageFields: Record<string, { readonly column: string }>;
  readonly valueSets?: Record<string, unknown>;
}): { contract: Contract; model: ContractModelBase } {
  const contract = createContract({
    domain: {
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          models: {
            User: {
              fields: {},
              relations: {},
              storage: {
                namespaceId: UNBOUND_NAMESPACE_ID,
                table: 'user',
                fields: parts.storageFields,
              },
            },
          },
        },
      },
    },
    storage: {
      namespaces: {
        [UNBOUND_NAMESPACE_ID]: {
          id: UNBOUND_NAMESPACE_ID,
          entries: {
            table: {
              user: { columns: column, uniques: [], indexes: [], foreignKeys: [] },
            },
            ...(parts.valueSets !== undefined ? { valueSet: parts.valueSets } : {}),
          },
        },
      },
      types: { money: { codecId: 'pg/numeric@1', typeParams: { precision: 19, scale: 4 } } },
    },
  });
  const models = Object.values(contract.domain.namespaces)[0]?.models ?? {};
  const model = Object.values(models)[0] as ContractModelBase;
  return { contract, model };
}

const resolveTypeParams = (fieldName: string, fixture: ReturnType<typeof contractWith>) =>
  sqlEmission.resolveFieldTypeParams?.('User', fieldName, fixture.model, fixture.contract);

const resolveValueSet = (fieldName: string, fixture: ReturnType<typeof contractWith>) =>
  sqlEmission.resolveFieldValueSet?.('User', fieldName, fixture.model, fixture.contract);

describe('resolveFieldTypeParams', () => {
  const fixture = contractWith({
    storageFields: {
      amount: { column: 'amount' },
      viaRef: { column: 'viaRef' },
      dangling: { column: 'danglingRef' },
      missingColumn: { column: 'nope' },
    },
  });

  it('reads the type params off the column', () => {
    expect(resolveTypeParams('amount', fixture)).toEqual({ precision: 10, scale: 2 });
  });

  it('follows a typeRef into the shared storage type', () => {
    expect(resolveTypeParams('viaRef', fixture)).toEqual({ precision: 19, scale: 4 });
  });

  it('resolves to nothing when the pieces are missing', () => {
    expect({
      unmappedField: resolveTypeParams('unmapped', fixture),
      missingColumn: resolveTypeParams('missingColumn', fixture),
      danglingTypeRef: resolveTypeParams('dangling', fixture),
    }).toEqual({
      unmappedField: undefined,
      missingColumn: undefined,
      danglingTypeRef: undefined,
    });
  });

  it('resolves to nothing when the model names a table the storage does not have', () => {
    const missingTable = contractWith({ storageFields: { amount: { column: 'amount' } } });
    const model = {
      ...missingTable.model,
      storage: {
        namespaceId: UNBOUND_NAMESPACE_ID,
        table: 'absent',
        fields: { amount: { column: 'amount' } },
      },
    } as ContractModelBase;

    expect(
      sqlEmission.resolveFieldTypeParams?.('User', 'amount', model, missingTable.contract),
    ).toBeUndefined();
  });

  it('resolves to nothing when the model carries no storage namespace', () => {
    const fixtureWithoutNamespace = contractWith({
      storageFields: { amount: { column: 'amount' } },
    });
    const model = {
      ...fixtureWithoutNamespace.model,
      storage: { table: 'user', fields: { amount: { column: 'amount' } } },
    } as ContractModelBase;

    expect(
      sqlEmission.resolveFieldTypeParams?.(
        'User',
        'amount',
        model,
        fixtureWithoutNamespace.contract,
      ),
    ).toBeUndefined();
  });
});

describe('resolveFieldValueSet', () => {
  const fixture = contractWith({
    storageFields: {
      role: { column: 'role' },
      id: { column: 'id' },
      missingColumn: { column: 'nope' },
    },
    valueSets: { Role: { kind: 'valueSet', values: ['user', 'admin'] } },
  });

  it('returns the referenced values with the column codec', () => {
    expect(resolveValueSet('role', fixture)).toEqual({
      encodedValues: ['user', 'admin'],
      codecId: 'pg/text@1',
    });
  });

  it('resolves to nothing when the field, column, or value set is absent', () => {
    const danglingValueSet = contractWith({
      storageFields: { role: { column: 'role' } },
    });

    expect({
      unmappedField: resolveValueSet('unmapped', fixture),
      missingColumn: resolveValueSet('missingColumn', fixture),
      columnWithoutValueSet: resolveValueSet('id', fixture),
      unresolvableValueSet: resolveValueSet('role', danglingValueSet),
    }).toEqual({
      unmappedField: undefined,
      missingColumn: undefined,
      columnWithoutValueSet: undefined,
      unresolvableValueSet: undefined,
    });
  });

  it('resolves to nothing when the model carries no storage namespace', () => {
    const model = {
      ...fixture.model,
      storage: { table: 'user', fields: { role: { column: 'role' } } },
    } as ContractModelBase;

    expect(
      sqlEmission.resolveFieldValueSet?.('User', 'role', model, fixture.contract),
    ).toBeUndefined();
  });
});

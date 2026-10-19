import type { ContractField } from '@internal/contract/types';
import { MongoFieldFilter } from '@internal/mongo-query-ast/execution';
import { MongoParamRef } from '@internal/mongo-value';
import { describe, expect, it } from 'vitest';
import { whereEquality } from '../src/where-equality';

const stringType = { kind: 'scalar', codecId: 'mongo/string@1' } as const;

const nullableListOfNullableItems: ContractField = {
  nullable: true,
  type: stringType,
  many: { elementNullable: true },
};

describe('whereEquality', () => {
  it('compiles null on a scalar list to a match on any value that is not an array', () => {
    expect(whereEquality('tags', nullableListOfNullableItems, null)).toEqual(
      MongoFieldFilter.of('tags', '$not', { $type: 'array' }),
    );
  });

  it('compiles null on a scalar field that is not a list to an equality with null', () => {
    expect(whereEquality('nickname', { nullable: true, type: stringType }, null)).toEqual(
      MongoFieldFilter.eq('nickname', null),
    );
  });

  it('compiles null on a value-object list to a match on any value that is not an array', () => {
    const entries: ContractField = {
      nullable: true,
      type: { kind: 'valueObject', name: 'Entry' },
      many: { elementNullable: true },
    };
    expect(whereEquality('entries', entries, null)).toEqual(
      MongoFieldFilter.of('entries', '$not', { $type: 'array' }),
    );
  });

  it('compiles a value on a scalar list to an equality with that value', () => {
    const value = [new MongoParamRef('a')];
    expect(whereEquality('tags', nullableListOfNullableItems, value)).toEqual(
      MongoFieldFilter.eq('tags', value),
    );
  });

  it('compiles null on an unknown field to an equality with null', () => {
    expect(whereEquality('unknown', undefined, null)).toEqual(MongoFieldFilter.eq('unknown', null));
  });
});

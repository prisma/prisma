import { Collection, orm } from '@internal/sql-orm-client';
import { describe, expect, expectTypeOf, it } from 'vitest';
import type { Contract } from '../../../3-targets/3-targets/sqlite/test/fixtures/sqlite-contract.d';
import contractJson from '../../../3-targets/3-targets/sqlite/test/fixtures/sqlite-contract.json' with {
  type: 'json',
};
import { defineContract } from '../src/exports/contract-builder';
import sqlite from '../src/exports/runtime';
import { contractFromJson } from '../src/exports/static';

const withFragmentModel = defineContract({}, ({ field, model }) => ({
  models: {
    fragment: model('fragment', { fields: { id: field.id.uuidv4String() } }),
  },
}));

describe('the sqlite ORM fragment member', () => {
  it('leaves the model names the only enumerable keys', () => {
    const db = sqlite({ contract: contractFromJson<Contract>(contractJson) });
    const namespace = orm({ runtime: db.runtime(), context: db.context }).__unbound__;

    expect(Object.keys(db.orm)).toEqual(Object.keys(namespace ?? {}));
  });

  it('gives way to a model named fragment, at run time and in the type', () => {
    const db = sqlite({ contract: withFragmentModel });

    expect(db.orm.fragment).toBeInstanceOf(Collection);
    expectTypeOf(db.orm.fragment).toHaveProperty('all');
  });
});

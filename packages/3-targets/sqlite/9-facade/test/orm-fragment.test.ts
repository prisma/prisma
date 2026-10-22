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
  it('is not an enumerable key of db.orm or tx.orm, which enumerate as the namespace does', async () => {
    const db = sqlite({ contract: contractFromJson<Contract>(contractJson), path: ':memory:' });
    const namespace = orm({ runtime: db.runtime(), context: db.context }).__unbound__;
    const txKeys = await db.transaction(async (tx) => Object.keys(tx.orm));
    await db.close();

    expect(Object.keys(db.orm)).not.toContain('fragment');
    expect(txKeys).not.toContain('fragment');
    expect({ db: Object.keys(db.orm), tx: txKeys }).toEqual({
      db: Object.keys(namespace ?? {}),
      tx: Object.keys(namespace ?? {}),
    });
  });

  it('gives way to a model named fragment, at run time and in the type', () => {
    const db = sqlite({ contract: withFragmentModel });

    expect(db.orm.fragment).toBeInstanceOf(Collection);
    expectTypeOf(db.orm.fragment).toHaveProperty('all');
  });
});

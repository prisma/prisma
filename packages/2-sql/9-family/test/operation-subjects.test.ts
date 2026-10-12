import { asNamespaceId } from '@internal/contract/types';
import { UNBOUND_NAMESPACE_ID } from '@internal/framework-components/ir';
import { describe, expect, it } from 'vitest';
import {
  type CallSubjects,
  fieldEventStorage,
  type SubjectStorage,
  subjectsOfCalls,
  unknownCallNames,
} from '../src/core/migrations/operation-subjects';
import type { TableRenameByHand } from '../src/core/migrations/statement-planning';
import { contractOf, renameField, renameModel } from './statement-fixtures';

const app = asNamespaceId('app');

const byHand: TableRenameByHand = {
  renderTableRename: ({ from, to }) => `this.renameTable("${from}", "${to}")`,
  tableRenameByHand: ({ from, to }) => [`ALTER TABLE "${from}" RENAME TO "${to}"`],
};

function table(name: string, storageName = name): SubjectStorage {
  return { storageName, table: { namespaceId: 'app', table: name, column: undefined } };
}

function column(tableName: string, columnName: string): SubjectStorage {
  return {
    storageName: `${tableName}.${columnName}`,
    table: { namespaceId: 'app', table: tableName, column: columnName },
  };
}

function losing(...targets: readonly SubjectStorage[]): CallSubjects {
  return { operationCount: 1, dataLoss: targets, accessWidening: [] };
}

const unchanged: CallSubjects = { operationCount: 1, dataLoss: [], accessWidening: [] };

const origin = contractOf({
  Legacy: { table: 'legacy', fields: { id: 'id' } },
  User: { table: 'user', fields: { id: 'id', name: 'full_name' } },
});

describe('subjectsOfCalls', () => {
  it('names the model of a dropped table and the field of a dropped column', () => {
    expect(
      subjectsOfCalls([unchanged, losing(table('legacy')), losing(column('user', 'full_name'))], {
        fromContract: origin,
        contract: contractOf({ User: { table: 'user', fields: { id: 'id' } } }),
        byHand,
        statements: [],
      }),
    ).toEqual({
      dataLoss: [
        { operationIndex: 1, subject: { kind: 'model', namespaceId: app, model: 'Legacy' } },
        {
          operationIndex: 2,
          subject: { kind: 'field', namespaceId: app, model: 'User', field: 'name' },
        },
      ],
      accessWidening: [],
    });
  });

  it('counts every operation of a call with companions before the next call', () => {
    expect(
      subjectsOfCalls(
        [{ operationCount: 3, dataLoss: [], accessWidening: [] }, losing(table('legacy'))],
        { fromContract: origin, contract: origin, byHand, statements: [] },
      ).dataLoss,
    ).toEqual([
      { operationIndex: 3, subject: { kind: 'model', namespaceId: app, model: 'Legacy' } },
    ]);
  });

  it('finds a table and a column renamed earlier in the plan under their origin names', () => {
    const destination = contractOf({
      Account: { table: 'account', fields: { id: 'id', displayName: 'display_name' } },
    });
    const from = contractOf({
      User: { table: 'user', fields: { id: 'id', name: 'full_name' } },
    });
    expect(
      subjectsOfCalls([losing(column('account', 'display_name'))], {
        fromContract: from,
        contract: destination,
        byHand,
        statements: [
          renameModel('User', 'Account'),
          renameField('User', 'name', 'displayName', 'Account'),
        ],
      }).dataLoss,
    ).toEqual([
      {
        operationIndex: 0,
        subject: { kind: 'field', namespaceId: app, model: 'User', field: 'name' },
      },
    ]);
  });

  it('names storage the origin contract does not declare by its storage name', () => {
    expect(
      subjectsOfCalls(
        [losing(table('audit_log', 'public.audit_log'), column('user', 'nickname'))],
        {
          fromContract: origin,
          contract: origin,
          byHand,
          statements: [],
        },
      ).dataLoss,
    ).toEqual([
      { operationIndex: 0, subject: { kind: 'storage', name: 'public.audit_log' } },
      { operationIndex: 0, subject: { kind: 'storage', name: 'user.nickname' } },
    ]);
  });

  it('names every subject by its storage name when the plan has no origin contract', () => {
    expect(
      subjectsOfCalls([losing(table('legacy'), column('user', 'full_name'))], {
        fromContract: null,
        contract: origin,
        byHand,
        statements: [],
      }).dataLoss,
    ).toEqual([
      { operationIndex: 0, subject: { kind: 'storage', name: 'legacy' } },
      { operationIndex: 0, subject: { kind: 'storage', name: 'user.full_name' } },
    ]);
  });

  it('names a subject with no table, such as a type, by its storage name', () => {
    expect(
      subjectsOfCalls([losing({ storageName: 'public.mood', table: undefined })], {
        fromContract: origin,
        contract: origin,
        byHand,
        statements: [],
      }).dataLoss,
    ).toEqual([{ operationIndex: 0, subject: { kind: 'storage', name: 'public.mood' } }]);
  });

  it('lists access-widening operations with the model of their table', () => {
    expect(
      subjectsOfCalls(
        [
          unchanged,
          {
            operationCount: 1,
            dataLoss: [],
            accessWidening: [{ ...table('user'), widens: false }],
          },
        ],
        { fromContract: origin, contract: origin, byHand, statements: [] },
      ),
    ).toEqual({
      dataLoss: [],
      accessWidening: [
        {
          operationIndex: 1,
          subject: { kind: 'model', namespaceId: app, model: 'User' },
          widens: false,
        },
      ],
    });
  });

  describe('models that share a table', () => {
    const sharing = contractOf({
      Admin: { table: 'users', base: 'User', fields: { id: 'id', level: 'level' } },
      Guest: { table: 'users', base: 'User', fields: { id: 'id' } },
      User: { table: 'users', fields: { id: 'id', email: 'email' } },
    });

    it('names the root model of a dropped table, and the model with a field for a dropped column', () => {
      expect(
        subjectsOfCalls([losing(table('users')), losing(column('users', 'email'))], {
          fromContract: sharing,
          contract: sharing,
          byHand,
          statements: [],
        }).dataLoss.map(({ subject }) => subject),
      ).toEqual([
        { kind: 'model', namespaceId: app, model: 'User' },
        { kind: 'field', namespaceId: app, model: 'User', field: 'email' },
      ]);
    });

    it('names a field only a variant has through the variant', () => {
      expect(
        subjectsOfCalls([losing(column('users', 'level'))], {
          fromContract: sharing,
          contract: sharing,
          byHand,
          statements: [],
        }).dataLoss.map(({ subject }) => subject),
      ).toEqual([{ kind: 'field', namespaceId: app, model: 'Admin', field: 'level' }]);
    });
  });
});

describe('unknownCallNames', () => {
  it('numbers the calls that share a factory name, and leaves a unique one alone', () => {
    const calls = [
      { factoryName: 'dropSearchConfig' },
      { factoryName: 'rebuildThing' },
      { factoryName: 'dropSearchConfig' },
    ];
    expect([...unknownCallNames(calls).values()]).toEqual([
      'dropSearchConfig#1',
      'rebuildThing',
      'dropSearchConfig#2',
    ]);
  });
});

describe('fieldEventStorage', () => {
  it('names the field event column, qualified by its namespace outside the unbound one', () => {
    const subjects = subjectsOfCalls(
      [
        losing(
          fieldEventStorage({ namespaceId: 'app', tableName: 'user', columnName: 'full_name' }),
          fieldEventStorage({ namespaceId: 'app', tableName: 'user', columnName: 'nickname' }),
        ),
      ],
      { fromContract: origin, contract: origin, byHand, statements: [] },
    );
    expect(subjects.dataLoss.map(({ subject }) => subject)).toEqual([
      { kind: 'field', namespaceId: app, model: 'User', field: 'name' },
      { kind: 'storage', name: 'app.user.nickname' },
    ]);
    expect(
      fieldEventStorage({ namespaceId: UNBOUND_NAMESPACE_ID, tableName: 'user', columnName: 'bio' })
        .storageName,
    ).toBe('user.bio');
  });
});

describe('subjectsOfCalls for a table whose model keeps its name', () => {
  const from = contractOf({ Profile: { table: 'profiles', fields: { id: 'id' } } });

  it('says how to rename the table by hand to keep its rows', () => {
    const to = contractOf({ Profile: { table: 'people', fields: { id: 'id' } } });

    expect(
      subjectsOfCalls([losing(table('profiles'))], {
        fromContract: from,
        contract: to,
        statements: [],
        byHand,
      }).dataLoss,
    ).toEqual([
      {
        operationIndex: 0,
        subject: { kind: 'model', namespaceId: app, model: 'Profile' },
        keepDataAdvice:
          'To keep its rows, rename table "profiles" to "people" instead; a statement cannot rename the table of a model that keeps its name. With db update, rename the table in the database yourself with ALTER TABLE "profiles" RENAME TO "people", then run prisma db update. With migration plan, write the rename as a migration of its own instead: run prisma migration new --name <name> --from <hash of the migration the database is at>, add this.renameTable("profiles", "people") to the operations of its migration.ts, from the project directory run node migrations/app/<directory>/migration.ts, naming the directory migration new wrote, so it writes ops.json, then run prisma db migrate.',
      },
    ]);
  });

  it('gives no advice when the destination has no model of that name', () => {
    const to = contractOf({ Person: { table: 'people', fields: { id: 'id' } } });

    expect(
      subjectsOfCalls([losing(table('profiles'))], {
        fromContract: from,
        contract: to,
        statements: [],
        byHand,
      }).dataLoss,
    ).toEqual([
      { operationIndex: 0, subject: { kind: 'model', namespaceId: app, model: 'Profile' } },
    ]);
  });

  it('gives no advice when the new table already holds another model of the origin', () => {
    const withPeople = contractOf({
      Profile: { table: 'profiles', fields: { id: 'id' } },
      Person: { table: 'people', fields: { id: 'id' } },
    });
    const to = contractOf({ Profile: { table: 'people', fields: { id: 'id' } } });

    expect(
      subjectsOfCalls([losing(table('profiles'))], {
        fromContract: withPeople,
        contract: to,
        statements: [],
        byHand,
      }).dataLoss.map(({ keepDataAdvice }) => keepDataAdvice),
    ).toEqual([undefined]);
  });
});

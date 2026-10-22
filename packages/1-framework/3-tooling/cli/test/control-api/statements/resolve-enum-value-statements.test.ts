import { asNamespaceId } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import { resolveStatements } from '../../../src/control-api/statements/resolve-statements';
import { renameStatements } from '../../../src/control-api/statements/statement-text';
import { contractOf, expectFailure, expectValue } from './statement-fixtures';

const UNRESOLVED = 'MIGRATION.STATEMENT_UNRESOLVED';
const INVALID = 'MIGRATION.STATEMENT_INVALID';

function resolve(
  renames: readonly string[],
  origin: ReturnType<typeof contractOf>,
  destination: ReturnType<typeof contractOf>,
) {
  return resolveStatements({
    statements: renameStatements(renames),
    origin: { kind: 'contract', contract: origin },
    destination,
  });
}

const app = asNamespaceId('app');
const origin = contractOf({
  app: {
    models: { Task: { fields: ['status'] } },
    enums: { Status: ['OPEN', 'ARCHIVED'], Priority: ['LOW', 'HIGH'] },
  },
});
const destination = contractOf({
  app: {
    models: { Task: { fields: ['status'] } },
    enums: { Status: ['OPEN', 'RETIRED'], Priority: ['LOW', 'HIGH'] },
  },
});

describe('resolveStatements, enum value renames', () => {
  it('reads Enum.value as a value of the enum', () => {
    expect(expectValue(resolve(['Status.ARCHIVED:Status.RETIRED'], origin, destination))).toEqual([
      {
        kind: 'rename',
        entity: 'enumValue',
        from: { namespaceId: app, enum: 'Status', member: 'ARCHIVED' },
        to: { namespaceId: app, enum: 'Status', member: 'RETIRED' },
      },
    ]);
  });

  it('reads namespace.Enum.value when several namespaces declare the enum', () => {
    const twoFrom = contractOf({
      public: { enums: { Status: ['OPEN', 'ARCHIVED'] } },
      billing: { enums: { Status: ['PAID'] } },
    });
    const twoTo = contractOf({
      public: { enums: { Status: ['OPEN', 'RETIRED'] } },
      billing: { enums: { Status: ['PAID'] } },
    });

    expect(
      expectValue(resolve(['public.Status.ARCHIVED:public.Status.RETIRED'], twoFrom, twoTo)),
    ).toEqual([
      {
        kind: 'rename',
        entity: 'enumValue',
        from: { namespaceId: asNamespaceId('public'), enum: 'Status', member: 'ARCHIVED' },
        to: { namespaceId: asNamespaceId('public'), enum: 'Status', member: 'RETIRED' },
      },
    ]);
    const failure = expectFailure(
      resolve(['Status.ARCHIVED:Status.RETIRED'], twoFrom, twoTo),
      UNRESOLVED,
    );
    expect(failure.why).toContain(
      '"Status" is an enum in more than one namespace of the origin contract (billing.Status, public.Status)',
    );
  });

  it('refuses a rename into another enum', () => {
    const failure = expectFailure(
      resolve(
        ['Status.ARCHIVED:Priority.MEDIUM'],
        origin,
        contractOf({
          app: {
            models: { Task: { fields: ['status'] } },
            enums: { Status: ['OPEN'], Priority: ['LOW', 'MEDIUM', 'HIGH'] },
          },
        }),
      ),
      INVALID,
    );
    expect({ why: failure.why, fix: failure.fix }).toEqual({
      why: 'The old name is a value of enum "Status" and the new name a value of enum "Priority"; a value cannot move between enums.',
      fix: 'Rename a value within one enum: --rename Status.ARCHIVED:Status.<new name>.',
    });
  });

  it('refuses an old value the destination still has, and a new one the origin already has', () => {
    expect(
      expectFailure(
        resolve(
          ['Status.OPEN:Status.RETIRED'],
          origin,
          contractOf({
            app: {
              models: { Task: { fields: ['status'] } },
              enums: { Status: ['OPEN', 'ARCHIVED', 'RETIRED'], Priority: ['LOW', 'HIGH'] },
            },
          }),
        ),
        UNRESOLVED,
      ).why,
    ).toBe(
      'The value "OPEN" still exists in the destination enum "Status", so it was not renamed.',
    );
    expect(
      expectFailure(resolve(['Status.ARCHIVED:Status.OPEN'], origin, destination), UNRESOLVED).why,
    ).toBe(
      'The value "OPEN" already exists in the origin enum "Status", so it cannot be the new name of a value.',
    );
  });

  it('names the values the enum has when the old one is missing', () => {
    expect(
      expectFailure(resolve(['Status.GONE:Status.RETIRED'], origin, destination), UNRESOLVED).why,
    ).toContain('the origin enum "Status" has no value "GONE" (values: ARCHIVED, OPEN)');
  });

  it('refuses a name that reads both as a field and as an enum value, naming both', () => {
    const both = (member: string) =>
      contractOf({
        app: { models: { Status: { fields: [member] } } },
        billing: { enums: { Status: [member] } },
      });
    const failure = expectFailure(
      resolve(['Status.ARCHIVED:Status.RETIRED'], both('ARCHIVED'), both('RETIRED')),
      UNRESOLVED,
    );
    expect(failure.why).toBe(
      '"Status.ARCHIVED" resolves both as model "Status" field "ARCHIVED" and as enum "Status" value "ARCHIVED".',
    );
    expect(failure.fix).toBe(
      'Name it with its namespace: app.Status.ARCHIVED for the field, billing.Status.ARCHIVED for the enum value.',
    );
  });

  it('renames a value of an enum whose namespace the same run renames, however the sides are written', () => {
    const billing = contractOf({
      app: { models: { Task: {} } },
      billing: { enums: { Status: ['OPEN', 'ARCHIVED'] } },
    });
    const finance = contractOf({
      app: { models: { Task: {} } },
      finance: { enums: { Status: ['OPEN', 'RETIRED'] } },
    });
    const expected = {
      kind: 'rename',
      entity: 'enumValue',
      from: { namespaceId: asNamespaceId('billing'), enum: 'Status', member: 'ARCHIVED' },
      to: { namespaceId: asNamespaceId('finance'), enum: 'Status', member: 'RETIRED' },
    };

    for (const text of [
      'Status.ARCHIVED:Status.RETIRED',
      'billing.Status.ARCHIVED:finance.Status.RETIRED',
      'finance.Status.ARCHIVED:finance.Status.RETIRED',
    ]) {
      expect(expectValue(resolve(['billing:finance', text], billing, finance))[1]).toEqual(
        expected,
      );
    }
  });
});

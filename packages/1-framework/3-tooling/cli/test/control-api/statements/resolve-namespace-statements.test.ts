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

const billing = contractOf({ app: { models: { User: {} } }, billing: { models: { Invoice: {} } } });
const finance = contractOf({ app: { models: { User: {} } }, finance: { models: { Invoice: {} } } });

describe('resolveStatements, namespace renames', () => {
  it('reads one name as a namespace when the origin has it as a namespace and the destination the new one', () => {
    expect(expectValue(resolve(['billing:finance'], billing, finance))).toEqual([
      { kind: 'rename', entity: 'namespace', from: 'billing', to: 'finance' },
    ]);
  });

  it('still reads one name as a model when no namespace has it', () => {
    const origin = contractOf({ app: { models: { Profile: {} } }, billing: {} });
    const destination = contractOf({ app: { models: { User: {} } }, billing: {} });
    expect(expectValue(resolve(['Profile:User'], origin, destination))).toEqual([
      {
        kind: 'rename',
        entity: 'model',
        from: { namespaceId: 'app', model: 'Profile' },
        to: { namespaceId: 'app', model: 'User' },
      },
    ]);
  });

  it('refuses a statement that reads both as a namespace and as a model, and says how to name the model', () => {
    const origin = contractOf({
      app: { models: { billing: {} } },
      billing: { models: { Invoice: {} } },
    });
    const destination = contractOf({
      app: { models: { finance: {} } },
      finance: { models: { Invoice: {} } },
    });
    const failure = expectFailure(resolve(['billing:finance'], origin, destination), UNRESOLVED);
    expect({ why: failure.why, fix: failure.fix }).toEqual({
      why: '"billing:finance" reads both as a rename of namespace "billing" to "finance" and as a rename of model "app.billing" to "app.finance".',
      fix: 'To rename the model, name it with its namespace: --rename app.billing:app.finance. A namespace is named by its name alone, so to rename the namespace, rename the model in a plan of its own first.',
    });
  });

  it('refuses a namespace the destination still has', () => {
    const both = contractOf({ billing: { models: { Invoice: {} } }, finance: {} });
    const failure = expectFailure(resolve(['billing:finance'], billing, both), UNRESOLVED);
    expect(failure.why).toBe(
      'Namespace "billing" still exists in the destination contract, so it was not renamed.',
    );
  });

  it('refuses a new name the destination has as no namespace, listing its namespaces', () => {
    const failure = expectFailure(resolve(['billing:finance'], billing, billing), UNRESOLVED);
    expect(failure.why).toBe(
      'Namespace "billing" still exists in the destination contract, so it was not renamed.',
    );
    const elsewhere = contractOf({ app: { models: { User: {} } }, ledger: {} });
    expect(expectFailure(resolve(['billing:finance'], billing, elsewhere), UNRESOLVED).why).toBe(
      'The destination contract has no namespace "finance" (namespaces: app, ledger).',
    );
  });

  it('refuses a new name the origin already has as a namespace', () => {
    const origin = contractOf({ billing: { models: { Invoice: {} } }, finance: {} });
    const destination = contractOf({ finance: { models: { Invoice: {} } } });
    expect(expectFailure(resolve(['billing:finance'], origin, destination), UNRESOLVED).why).toBe(
      'Namespace "finance" already exists in the origin contract, so it cannot be the new name of a namespace.',
    );
  });

  it('refuses a second rename of the same namespace', () => {
    const failure = expectFailure(
      resolve(['billing:finance', 'billing:finance'], billing, finance),
      INVALID,
    );
    expect(failure.why).toBe('An earlier statement already renames namespace "billing".');
  });
});

import { describe, expect, it } from 'vitest';
import { planStatements } from '../src/core/migrations/statement-planning';
import {
  ALL_CLASSES,
  contractOf,
  fakeTarget,
  planned,
  refusingNamespaceRenames,
  rejection,
  renameField,
  renameModel,
  renameNamespace,
} from './statement-fixtures';

const inBilling = contractOf({
  Invoice: { table: 'Invoice', namespace: 'billing', fields: { total: 'total' } },
});
const inFinance = contractOf({
  Invoice: { table: 'Invoice', namespace: 'finance', fields: { total: 'total' } },
});
const statement = renameNamespace('billing', 'finance');

describe('a namespace rename', () => {
  it('renames the namespace through the target, and applies it to the working schema', () => {
    const target = fakeTarget(['billing.Invoice']);

    const result = planStatements({
      statements: [statement],
      fromContract: inBilling,
      contract: inFinance,
      policy: ALL_CLASSES,
      target,
    });

    expect(planned(result)).toMatchObject({
      calls: ['rename-namespace billing -> finance'],
      appliedStatements: [{ statement, operationIndexes: [0] }],
    });
    expect(target.tables().hasTable('finance', 'Invoice')).toBe(true);
  });

  it('names the tables of the renamed namespace by their new namespace in later statements', () => {
    const result = planStatements({
      statements: [
        statement,
        renameModel('Invoice', 'Bill', 'billing', 'finance'),
        renameField('Invoice', 'total', 'amount', 'Bill', 'billing', 'finance'),
      ],
      fromContract: inBilling,
      contract: contractOf({
        Bill: { table: 'Bill', namespace: 'finance', fields: { amount: 'amount' } },
      }),
      policy: ALL_CLASSES,
      target: fakeTarget(['billing.Invoice'], { 'billing.Invoice': ['total'] }),
    });

    expect(planned(result).calls).toEqual([
      'rename-namespace billing -> finance',
      'table finance.Invoice -> Bill',
      'column finance.Bill.total -> amount',
    ]);
  });

  it('refuses what the target refuses, in its words', () => {
    const conflict = rejection(
      planStatements({
        statements: [statement],
        fromContract: inBilling,
        contract: inFinance,
        policy: ALL_CLASSES,
        target: refusingNamespaceRenames(fakeTarget(['billing.Invoice']), {
          reason: 'it is the default namespace',
          fix: 'Move the models instead.',
        }),
      }),
    );

    expect(conflict).toMatchObject({
      kind: 'statementRefused',
      summary: 'Cannot rename namespace "billing" to "finance": it is the default namespace',
      why: 'Move the models instead.',
      refusedStatement: statement,
    });
  });

  it('refuses a namespace with a table whose control policy is not managed', () => {
    const conflict = rejection(
      planStatements({
        statements: [statement],
        fromContract: inBilling,
        contract: contractOf({
          Invoice: { table: 'Invoice', namespace: 'finance', control: 'external' },
        }),
        policy: ALL_CLASSES,
        target: fakeTarget(['billing.Invoice']),
      }),
    );

    expect(conflict).toMatchObject({
      summary:
        'Cannot rename namespace "billing" to "finance": table "Invoice" has control policy "external"',
      why: 'Statements rename only namespaces whose tables all have control policy "managed"; table "Invoice" is "external". Make the change in the database yourself and leave out this statement.',
    });
  });

  it('refuses a namespace the schema being planned from does not have', () => {
    expect(
      rejection(
        planStatements({
          statements: [statement],
          fromContract: inBilling,
          contract: inFinance,
          policy: ALL_CLASSES,
          target: fakeTarget([]),
        }),
      ).summary,
    ).toBe(
      'Cannot rename namespace "billing" to "finance": the schema being planned from has no namespace "billing"',
    );
  });

  it('refuses a new name the schema being planned from already has', () => {
    const conflict = rejection(
      planStatements({
        statements: [statement],
        fromContract: inBilling,
        contract: inFinance,
        policy: ALL_CLASSES,
        target: fakeTarget(['billing.Invoice', 'finance.Other']),
      }),
    );

    expect(conflict).toMatchObject({
      summary:
        'Cannot rename namespace "billing" to "finance": the schema being planned from already has a namespace "finance"',
      why: 'A rename cannot replace a namespace that already exists. Rename or drop namespace "finance" first, or leave out this statement.',
    });
  });

  it('refuses a rename whose operation class the plan does not allow', () => {
    expect(
      rejection(
        planStatements({
          statements: [statement],
          fromContract: inBilling,
          contract: inFinance,
          policy: { allowedOperationClasses: ['additive'] },
          target: fakeTarget(['billing.Invoice']),
        }),
      ),
    ).toMatchObject({ refusedOperationClass: 'widening' });
  });

  it('plans namespace renames first, so the order the statements are given in does not matter', () => {
    const modelStatement = renameModel('Invoice', 'Bill', 'billing', 'finance');
    const planIn = (
      statements: readonly ReturnType<typeof renameModel | typeof renameNamespace>[],
    ) =>
      planned(
        planStatements({
          statements,
          fromContract: inBilling,
          contract: contractOf({ Bill: { table: 'Bill', namespace: 'finance' } }),
          policy: ALL_CLASSES,
          target: fakeTarget(['billing.Invoice']),
        }),
      ).calls;

    expect(planIn([modelStatement, statement])).toEqual([
      'rename-namespace billing -> finance',
      'table finance.Invoice -> Bill',
    ]);
    expect(planIn([statement, modelStatement])).toEqual(planIn([modelStatement, statement]));
  });

  it('reports where each origin table and column now is, read the other way round', () => {
    const result = planStatements({
      statements: [
        statement,
        renameModel('Invoice', 'Bill', 'billing', 'finance'),
        renameField('Invoice', 'total', 'amount', 'Bill', 'billing', 'finance'),
      ],
      fromContract: inBilling,
      contract: contractOf({
        Bill: { table: 'Bill', namespace: 'finance', fields: { amount: 'amount' } },
      }),
      policy: ALL_CLASSES,
      target: fakeTarget(['billing.Invoice', 'billing.Other'], { 'billing.Invoice': ['total'] }),
    });
    if (!result.ok) throw new Error(result.failure.summary);
    const { places } = result.value;
    const origin = { namespaceId: 'billing', table: 'Invoice' };

    expect({
      moved: places.originTable({ namespaceId: 'finance', table: 'Bill' }),
      untouched: places.originTable({ namespaceId: 'finance', table: 'Other' }),
      column: places.originColumn(origin, 'amount'),
    }).toEqual({
      moved: origin,
      untouched: { namespaceId: 'billing', table: 'Other' },
      column: 'total',
    });
  });
});

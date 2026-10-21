import { asNamespaceId } from '@internal/contract/types';
import { ok } from '@internal/utils/result';
import { describe, expect, it } from 'vitest';
import {
  askPlanQuestions,
  type PlannedQuestions,
  refuseUnusedConsents,
} from '../../../src/control-api/statements/plan-questions';
import { contractOf } from './statement-fixtures';

const origin = contractOf({
  app: { models: { User: {} } },
  billing: { models: { Invoice: {}, Receipt: {} } },
});
const destination = contractOf({ app: { models: { User: {} } } });

const dropModel = (model: string, operationIndex: number) => ({
  operationIndex,
  label: `Drop table "${model.toLowerCase()}"`,
  loss: 'drop' as const,
  subject: { kind: 'model' as const, namespaceId: asNamespaceId('billing'), model },
});

const plan: PlannedQuestions = {
  dataLoss: [dropModel('Invoice', 0), dropModel('Receipt', 1)],
  accessChanges: [],
};

function ask(preAnswers: readonly { verb: 'delete'; text: string }[]) {
  const asked: string[] = [];
  return {
    asked,
    result: askPlanQuestions({
      plan,
      askAccess: false,
      canConvert: false,
      statements: [],
      preAnswers,
      consentAll: { delete: false, allow: false },
      origin,
      originKnown: true,
      destination,
      answer: async (questions) => {
        asked.push(...questions.map(({ subject }) => subject));
        return questions.map(({ subject }) => ({ verb: 'delete', text: subject }));
      },
      replan: async () => ok(plan),
    }),
  };
}

describe('--delete with a namespace of the origin contract', () => {
  it('answers the question about every model of the namespace, each reported by its model', async () => {
    const { asked, result } = ask([{ verb: 'delete', text: 'billing' }]);

    const outcome = await result;
    expect(asked).toEqual([]);
    expect(
      outcome.ok && outcome.value.consented.map(({ verb, text }) => `${verb} ${text}`),
    ).toEqual(['delete billing.Invoice', 'delete billing.Receipt']);
  });

  it('is refused as unused when no question is about the namespace', async () => {
    const { result } = ask([{ verb: 'delete', text: 'ledger' }]);

    const outcome = await result;
    expect(!outcome.ok && outcome.failure).toMatchObject({
      code: 'MIGRATION.STATEMENT_ANSWERS_NO_QUESTION',
    });
  });

  it('counts as used on a dry run', () => {
    expect(
      refuseUnusedConsents({
        plan,
        statements: [{ verb: 'delete', text: 'billing' }],
        contracts: { origin, destination, statements: [] },
      }).ok,
    ).toBe(true);
  });
});

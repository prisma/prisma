import { asNamespaceId } from '@internal/contract/types';
import { ok } from '@internal/utils/result';
import { describe, expect, it } from 'vitest';
import {
  askPlanQuestions,
  consentDescription,
  type PlannedQuestions,
  type PlanQuestion,
} from '../../../src/control-api/statements/plan-questions';
import { contractOf } from './statement-fixtures';

const origin = contractOf({
  app: { models: { Task: { fields: ['status'] } }, enums: { Status: ['OPEN', 'ARCHIVED'] } },
});
const destination = contractOf({
  app: { models: { Task: { fields: ['status'] } }, enums: { Status: ['OPEN', 'RETIRED'] } },
});
const archived = {
  kind: 'enumValue',
  namespaceId: asNamespaceId('app'),
  enum: 'Status',
  member: 'ARCHIVED',
} as const;
const plan: PlannedQuestions = {
  dataLoss: [
    {
      operationIndex: 0,
      label: 'Change values in "Task"."status"',
      loss: 'drop',
      subject: archived,
    },
  ],
  accessChanges: [],
};

async function questionsOf(statements: readonly { verb: 'rename'; text: string }[] = []) {
  const asked: PlanQuestion[] = [];
  await askPlanQuestions({
    plan,
    askAccess: false,
    canConvert: false,
    statements,
    preAnswers: [],
    consentAll: { delete: false, allow: false },
    origin,
    originKnown: true,
    destination,
    answer: async (batch) => {
      asked.push(...batch);
      return batch.map(({ subject }) => ({ verb: 'delete', text: subject }));
    },
    replan: async () => ok({ dataLoss: [], accessChanges: [] }),
  });
  return asked;
}

describe('a question about an enum value', () => {
  it('names the value through its enum, and offers to rename or delete it', async () => {
    const [question] = await questionsOf();

    expect(question).toMatchObject({
      subject: 'Status.ARCHIVED',
      question:
        'Change values in "Task"."status" would lose enum value "Status.ARCHIVED" from the data that holds it.',
      verbs: ['rename', 'delete'],
      forms: { rename: 'Status.ARCHIVED:Status.<new name>' },
    });
    expect(question?.validate('delete', 'Status.ARCHIVED')).toBeUndefined();
    expect(question?.validate('rename', 'Status.ARCHIVED:Status.RETIRED')).toBeUndefined();
  });

  it('is described as an enum value when answered', () => {
    expect(consentDescription('delete', archived, 'Status.ARCHIVED', 'drop')).toBe(
      'delete enum value "Status.ARCHIVED"',
    );
  });

  it('names a value of an enum in a renamed namespace through the new namespace, with a rename that resolves', async () => {
    const billing = contractOf({
      app: { models: { Task: {} } },
      billing: { enums: { Status: ['OPEN', 'ARCHIVED'] } },
    });
    const finance = contractOf({
      app: { models: { Task: {} } },
      finance: { enums: { Status: ['OPEN', 'RETIRED'] } },
    });
    const subject = { ...archived, namespaceId: asNamespaceId('billing') };
    const asked: PlanQuestion[] = [];

    await askPlanQuestions({
      plan: {
        dataLoss: [{ operationIndex: 0, label: 'Change values', loss: 'drop', subject }],
        accessChanges: [],
      },
      askAccess: false,
      canConvert: false,
      statements: [{ verb: 'rename', text: 'billing:finance' }],
      preAnswers: [],
      consentAll: { delete: false, allow: false },
      origin: billing,
      originKnown: true,
      destination: finance,
      answer: async (batch) => {
        asked.push(...batch);
        return batch.map(({ subject: text }) => ({ verb: 'delete', text }));
      },
      replan: async () => ok({ dataLoss: [], accessChanges: [] }),
    });

    expect(asked[0]).toMatchObject({
      subject: 'finance.Status.ARCHIVED',
      forms: { rename: 'finance.Status.ARCHIVED:finance.Status.<new name>' },
    });
    expect(
      asked[0]?.validate('rename', 'finance.Status.ARCHIVED:finance.Status.RETIRED'),
    ).toBeUndefined();
  });
});

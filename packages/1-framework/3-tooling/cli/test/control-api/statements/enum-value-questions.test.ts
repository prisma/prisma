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
        'Change values in "Task"."status" would lose enum value "Status.ARCHIVED" from the rows that hold it.',
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
});

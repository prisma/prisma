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
      defaultNamespaceId: 'public',
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

  it('says once, on the first question about the removed namespace, that --delete of it answers them all', async () => {
    const questions: string[] = [];
    await askPlanQuestions({
      plan,
      askAccess: false,
      canConvert: false,
      statements: [],
      preAnswers: [],
      consentAll: { delete: false, allow: false },
      origin,
      originKnown: true,
      destination,
      defaultNamespaceId: 'public',
      answer: async (batch) => {
        questions.push(...batch.map(({ question }) => question));
        return batch.map(({ subject }) => ({ verb: 'delete', text: subject }));
      },
      replan: async () => ok(plan),
    });

    expect(questions).toEqual([
      'Drop table "invoice" would lose the data of model "billing.Invoice".\n--delete billing answers every question about namespace "billing", which the destination contract no longer has.',
      'Drop table "receipt" would lose the data of model "billing.Receipt".',
    ]);
  });

  async function firstQuestion(to: ReturnType<typeof contractOf>): Promise<string | undefined> {
    const questions: string[] = [];
    await askPlanQuestions({
      plan,
      askAccess: false,
      canConvert: false,
      statements: [],
      preAnswers: [],
      consentAll: { delete: false, allow: false },
      origin,
      originKnown: true,
      destination: to,
      defaultNamespaceId: 'public',
      answer: async (batch) => {
        questions.push(...batch.map(({ question }) => question));
        return batch.map(({ subject }) => ({ verb: 'delete', text: subject }));
      },
      replan: async () => ok(plan),
    });
    return questions[0];
  }

  it('offers a rename to the one namespace the destination adds', async () => {
    const renamed = contractOf({
      app: { models: { User: {} } },
      finance: { models: { Invoice: {}, Receipt: {} } },
    });

    expect(await firstQuestion(renamed)).toBe(
      'Drop table "invoice" would lose the data of model "billing.Invoice".\n--delete billing answers every question about namespace "billing", which the destination contract no longer has.\nIf namespace "billing" was renamed, --rename billing:finance renames it instead.',
    );
  });

  it('offers a rename to each namespace the destination adds when it adds several', async () => {
    const renamed = contractOf({
      app: { models: { User: {} } },
      finance: { models: { Invoice: {} } },
      ledger: { models: { Receipt: {} } },
    });

    expect(await firstQuestion(renamed)).toBe(
      'Drop table "invoice" would lose the data of model "billing.Invoice".\n--delete billing answers every question about namespace "billing", which the destination contract no longer has.\nIf namespace "billing" was renamed, --rename billing:<new namespace> renames it instead, where <new namespace> is finance or ledger.',
    );
  });

  it('does not answer a question about a namespace the destination still has', async () => {
    const kept = contractOf({
      app: { models: { User: { fields: ['id'] } } },
      billing: { models: { Invoice: {}, Receipt: {} } },
    });
    const nickname = {
      operationIndex: 0,
      label: 'Drop column "nickname" from "User"',
      loss: 'drop' as const,
      subject: {
        kind: 'field' as const,
        namespaceId: asNamespaceId('app'),
        model: 'User',
        field: 'nickname',
      },
    };
    const keptPlan: PlannedQuestions = { dataLoss: [nickname], accessChanges: [] };
    const asked: string[] = [];

    const outcome = await askPlanQuestions({
      plan: keptPlan,
      askAccess: false,
      canConvert: false,
      statements: [],
      preAnswers: [{ verb: 'delete', text: 'app' }],
      consentAll: { delete: false, allow: false },
      origin: contractOf({
        app: { models: { User: { fields: ['id', 'nickname'] } } },
        billing: { models: { Invoice: {}, Receipt: {} } },
      }),
      originKnown: true,
      destination: kept,
      defaultNamespaceId: 'public',
      answer: async (questions) => {
        asked.push(...questions.map(({ subject }) => subject));
        return questions.map(({ subject }) => ({ verb: 'delete', text: subject }));
      },
      replan: async () => ok(keptPlan),
    });

    expect(asked).toEqual(['app.User.nickname']);
    expect(!outcome.ok && outcome.failure).toMatchObject({
      code: 'MIGRATION.STATEMENT_ANSWERS_NO_QUESTION',
    });
  });
});

describe('namespace hints that would not work', () => {
  const dropOf = (namespace: string, model: string) => ({
    operationIndex: 0,
    label: `Drop table "${model}"`,
    loss: 'drop' as const,
    subject: { kind: 'model' as const, namespaceId: asNamespaceId(namespace), model },
  });

  async function questionsFor(input: {
    readonly from: ReturnType<typeof contractOf>;
    readonly to: ReturnType<typeof contractOf>;
    readonly drop: ReturnType<typeof dropOf>;
    readonly statements?: readonly { verb: 'rename'; text: string }[];
    readonly preAnswers?: readonly { verb: 'delete'; text: string }[];
  }) {
    const lossPlan: PlannedQuestions = { dataLoss: [input.drop], accessChanges: [] };
    const questions: string[] = [];
    const outcome = await askPlanQuestions({
      plan: lossPlan,
      askAccess: false,
      canConvert: false,
      statements: input.statements ?? [],
      preAnswers: input.preAnswers ?? [],
      consentAll: { delete: false, allow: false },
      origin: input.from,
      originKnown: true,
      destination: input.to,
      defaultNamespaceId: 'public',
      answer: async (batch) => {
        questions.push(...batch.map(({ question }) => question));
        return batch.map(({ subject }) => ({ verb: 'delete', text: subject }));
      },
      replan: async () => ok(lossPlan),
    });
    return { questions, outcome };
  }

  it('says nothing of a namespace the run renames', async () => {
    const { questions } = await questionsFor({
      from: contractOf({ app: { models: { User: {} } }, finance: { models: { Bill: {} } } }),
      to: contractOf({ app: { models: { User: {} } }, billing: { models: { Invoice: {} } } }),
      drop: dropOf('finance', 'Bill'),
      statements: [{ verb: 'rename', text: 'finance:billing' }],
    });

    expect(questions).toEqual(['Drop table "Bill" would lose the data of model "finance.Bill".']);
  });

  it('never offers --delete of the default namespace, and --delete of it answers nothing', async () => {
    const from = contractOf({
      public: { models: { User: {} } },
      billing: { models: { Invoice: {} } },
    });
    const to = contractOf({ app: { models: { User: {} } }, billing: { models: { Invoice: {} } } });

    const asked = await questionsFor({ from, to, drop: dropOf('public', 'User') });
    expect(asked.questions.join('\n')).not.toContain('--delete public');
    expect(asked.questions.join('\n')).not.toContain('--rename public:');

    const deleted = await questionsFor({
      from,
      to,
      drop: dropOf('public', 'User'),
      preAnswers: [{ verb: 'delete', text: 'public' }],
    });
    expect(!deleted.outcome.ok && deleted.outcome.failure).toMatchObject({
      code: 'MIGRATION.STATEMENT_ANSWERS_NO_QUESTION',
    });
  });

  it('never offers a rename to the default namespace', async () => {
    const { questions } = await questionsFor({
      from: contractOf({ billing: { models: { Invoice: {} } } }),
      to: contractOf({ public: { models: { Invoice: {} } } }),
      drop: dropOf('billing', 'Invoice'),
    });

    expect(questions).toEqual([
      'Drop table "Invoice" would lose the data of model "Invoice".\n--delete billing answers every question about namespace "billing", which the destination contract no longer has.',
    ]);
  });
});

describe('a namespace answer typed at the prompt', () => {
  const finance = contractOf({
    app: { models: { User: {} } },
    finance: { models: { Invoice: {}, Receipt: {} } },
  });

  it('accepts delete of the removed namespace for each of its questions', async () => {
    const outcome = await askPlanQuestions({
      plan,
      askAccess: false,
      canConvert: false,
      statements: [],
      preAnswers: [],
      consentAll: { delete: false, allow: false },
      origin,
      originKnown: true,
      destination,
      defaultNamespaceId: 'public',
      answer: async (batch) => {
        for (const question of batch)
          expect(question.validate('delete', 'billing')).toBeUndefined();
        return batch.map(() => ({ verb: 'delete', text: 'billing' }));
      },
      replan: async () => ok(plan),
    });

    expect(
      outcome.ok && outcome.value.consented.map(({ verb, text }) => `${verb} ${text}`),
    ).toEqual(['delete billing.Invoice', 'delete billing.Receipt']);
  });

  it('accepts a rename of the removed namespace, and plans it once', async () => {
    const replanned: (readonly string[])[] = [];
    const outcome = await askPlanQuestions({
      plan,
      askAccess: false,
      canConvert: false,
      statements: [],
      preAnswers: [],
      consentAll: { delete: false, allow: false },
      origin,
      originKnown: true,
      destination: finance,
      defaultNamespaceId: 'public',
      answer: async (batch) => {
        for (const question of batch) {
          expect(question.validate('rename', 'billing:finance')).toBeUndefined();
        }
        return batch.map(() => ({ verb: 'rename', text: 'billing:finance' }));
      },
      replan: async (statements) => {
        replanned.push(statements.map(({ verb, text }) => `${verb} ${text}`));
        return ok({ dataLoss: [], accessChanges: [] });
      },
    });

    expect(outcome.ok).toBe(true);
    expect(replanned).toEqual([['rename billing:finance']]);
  });
});

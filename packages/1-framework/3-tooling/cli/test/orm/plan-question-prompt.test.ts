import type { PromptSurface, StatementSurface } from '@prisma/cli-engine';
import { describe, expect, it, vi } from 'vitest';
import type { PlanQuestion } from '../../src/control-api/statements/plan-questions';
import { promptPlanQuestions } from '../../src/orm/plan-question-prompt';

function question(subject: string, namespace?: string): PlanQuestion {
  return {
    question: `Drop ${subject}?`,
    subject,
    ...(namespace === undefined ? {} : { removedNamespace: namespace }),
    verbs: ['delete'],
    forms: {},
    validate: () => undefined,
  };
}

function surfaces(deletes: readonly string[]) {
  let remaining = deletes.map((text) => ({ verb: 'delete', text, values: [text] }));
  const statements: StatementSurface = {
    take: vi.fn((verb: string) => {
      const taken = remaining.filter((value) => value.verb === verb);
      remaining = remaining.filter((value) => value.verb !== verb);
      return taken;
    }) as StatementSurface['take'],
    values: () => remaining,
  };
  const asked: string[][] = [];
  const prompt = {
    statements: vi.fn(async (questions: readonly { readonly subject: string }[]) => {
      asked.push(questions.map(({ subject }) => subject));
      return questions.map(({ subject }) => ({ verb: 'delete', text: subject, values: [subject] }));
    }),
  } as unknown as PromptSurface;
  return { statements, prompt, asked };
}

const invoice = question('billing.Invoice', 'billing');
const receipt = question('billing.Receipt', 'billing');
const user = question('app.User', 'app');

describe('a plan question asked through the engine', () => {
  it('answers every question of a namespace a --delete names, and asks the engine the rest', async () => {
    const { statements, prompt, asked } = surfaces(['billing']);

    const answers = await promptPlanQuestions(prompt, statements)([invoice, user, receipt]);

    expect(answers).toEqual([
      { verb: 'delete', text: 'billing.Invoice' },
      { verb: 'delete', text: 'app.User' },
      { verb: 'delete', text: 'billing.Receipt' },
    ]);
    expect(asked).toEqual([['app.User'], []]);
  });

  it('answers a --delete of a subject given beside a namespace --delete', async () => {
    const { statements, prompt, asked } = surfaces(['billing', 'app.User']);

    const answers = await promptPlanQuestions(prompt, statements)([invoice, user]);

    expect(answers.map(({ text }) => text)).toEqual(['billing.Invoice', 'app.User']);
    expect(asked).toEqual([[]]);
  });

  it('leaves every --delete to the engine when none names a namespace of the questions', async () => {
    const { statements, prompt, asked } = surfaces(['billing.Invoice']);

    await promptPlanQuestions(prompt, statements)([invoice, user]);

    expect(statements.take).not.toHaveBeenCalled();
    expect(asked).toEqual([['billing.Invoice'], ['app.User'], []]);
  });

  it('refuses a --delete that answers nothing beside a namespace --delete, as the engine refuses an unused flag', async () => {
    const { statements, prompt } = surfaces(['billing', 'nope']);

    await expect(promptPlanQuestions(prompt, statements)([invoice])).rejects.toMatchObject({
      code: 'CLI.CONSENT_UNUSED',
      message: '--delete nope was given but nothing in this run asked about nope.',
      why: 'The run asked about billing.Invoice.',
      meta: { unused: [{ verb: 'delete', values: ['nope'] }], asked: ['billing.Invoice'] },
    });
  });

  it('says a --delete of a subject was already answered by the namespace --delete given before it', async () => {
    const { statements, prompt } = surfaces(['billing', 'billing.Invoice']);

    await expect(promptPlanQuestions(prompt, statements)([invoice, receipt])).rejects.toMatchObject(
      {
        code: 'CLI.CONSENT_UNUSED',
        message:
          '--delete billing.Invoice was given, but the question about billing.Invoice was already answered by --delete billing.',
        nextActions: [{ kind: 'user-choice', label: 'Give one flag per question.' }],
      },
    );
  });

  it('says a namespace --delete answered nothing new when other flags answered every question of it', async () => {
    const { statements, prompt } = surfaces(['billing.Invoice', 'billing']);

    await expect(promptPlanQuestions(prompt, statements)([invoice])).rejects.toMatchObject({
      code: 'CLI.CONSENT_UNUSED',
      message:
        '--delete billing was given, but every question about namespace "billing" was already answered by another flag.',
      nextActions: [{ kind: 'user-choice', label: 'Give one flag per question.' }],
    });
  });
});

describe('a namespace answer typed at the prompt', () => {
  function typing(answerFor: (subject: string) => { verb: string; text: string }) {
    const asked: string[][] = [];
    const statements: StatementSurface = {
      take: vi.fn(() => []) as StatementSurface['take'],
      values: () => [],
    };
    const prompt = {
      statements: vi.fn(async (questions: readonly { readonly subject: string }[]) => {
        asked.push(questions.map(({ subject }) => subject));
        return questions.map(({ subject }) => ({ ...answerFor(subject), values: [] }));
      }),
    } as unknown as PromptSurface;
    return { statements, prompt, asked };
  }

  it('answers the rest of the namespace with a delete of it, without asking them', async () => {
    const { statements, prompt, asked } = typing((subject) =>
      subject === 'billing.Invoice'
        ? { verb: 'delete', text: 'billing' }
        : { verb: 'delete', text: subject },
    );

    const answers = await promptPlanQuestions(prompt, statements)([invoice, user, receipt]);

    expect(answers).toEqual([
      { verb: 'delete', text: 'billing' },
      { verb: 'delete', text: 'app.User' },
      { verb: 'delete', text: 'billing' },
    ]);
    expect(asked).toEqual([['billing.Invoice'], ['app.User'], []]);
  });

  it('answers the rest of the namespace with a rename of it, without asking them', async () => {
    const { statements, prompt, asked } = typing(() => ({
      verb: 'rename',
      text: 'billing:finance',
    }));

    const answers = await promptPlanQuestions(prompt, statements)([invoice, receipt]);

    expect(answers).toEqual([
      { verb: 'rename', text: 'billing:finance' },
      { verb: 'rename', text: 'billing:finance' },
    ]);
    expect(asked).toEqual([['billing.Invoice'], []]);
  });

  it('lets the engine refuse every question still unanswered at once when nobody can answer', async () => {
    const asked: string[][] = [];
    const statements: StatementSurface = {
      take: vi.fn(() => []) as StatementSurface['take'],
      values: () => [],
    };
    const prompt = {
      statements: vi.fn(async (questions: readonly { readonly subject: string }[]) => {
        asked.push(questions.map(({ subject }) => subject));
        throw Object.assign(new Error('needs a statement'), {
          code: 'CLI.CONSENT_REQUIRED',
          unanswered: questions.map(({ subject }) => subject),
        });
      }),
    } as unknown as PromptSurface;

    await expect(
      promptPlanQuestions(prompt, statements)([invoice, user, receipt]),
    ).rejects.toMatchObject({
      code: 'CLI.CONSENT_REQUIRED',
      unanswered: ['billing.Invoice', 'app.User', 'billing.Receipt'],
    });
    expect(asked).toEqual([
      ['billing.Invoice'],
      ['billing.Invoice', 'app.User', 'billing.Receipt'],
    ]);
  });
});

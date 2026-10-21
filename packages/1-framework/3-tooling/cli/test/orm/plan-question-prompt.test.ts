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
    expect(asked).toEqual([['app.User']]);
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
    expect(asked).toEqual([['billing.Invoice', 'app.User']]);
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
});

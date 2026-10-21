import type { PromptSurface, StatementSurface } from '@prisma/cli-engine';
import {
  type AnswerPlanQuestions,
  consentAnswers,
  type PlanAnswer,
  type PlanQuestion,
} from '../control-api/statements/plan-questions';
import { errorConsentUnused, type UnusedConsent } from '../utils/cli-errors';

/** The flag that already answered the question a `--delete` value names, if any did. */
function answeredBefore(
  text: string,
  questions: readonly PlanQuestion[],
  answeredWith: ReadonlyMap<string, string>,
): UnusedConsent['answeredBy'] {
  const flag = answeredWith.get(text);
  if (flag !== undefined) {
    return { kind: 'subject', subject: text, flag: { verb: 'delete', text: flag } };
  }
  return questions.some(({ removedNamespace }) => removedNamespace === text)
    ? { kind: 'namespace', namespace: text }
    : undefined;
}

/**
 * The answers the `--delete` values give when one of them names a namespace of the questions: the
 * engine answers a question only with a value equal to its subject, one value per question, so a
 * namespace that answers every question about its models is matched here. The values are taken
 * from the engine; `undefined` leaves them to it.
 */
function namespaceDeletes(
  questions: readonly PlanQuestion[],
  statements: StatementSurface,
): ReadonlyMap<number, PlanAnswer> | undefined {
  const deletes = statements.values().filter(({ verb }) => verb === 'delete');
  const removed = new Set(questions.flatMap(({ removedNamespace }) => removedNamespace ?? []));
  if (!deletes.some(({ text }) => removed.has(text))) return undefined;
  const taken = statements.take('delete').map(({ text }) => text);
  const answered = new Map<number, PlanAnswer>();
  const used = new Set<string>();
  const answeredWith = new Map<string, string>();
  questions.forEach((question, index) => {
    if (!question.verbs.includes('delete')) return;
    const target = { text: question.subject, removedNamespace: question.removedNamespace };
    const given = taken.find((text) => consentAnswers('delete', text, target));
    if (given === undefined) return;
    used.add(given);
    answeredWith.set(question.subject, given);
    answered.set(index, { verb: 'delete', text: question.subject });
  });
  const unused = taken.filter((text) => !used.has(text));
  if (unused.length > 0) {
    throw errorConsentUnused(
      unused.map((text) => ({
        verb: 'delete',
        text,
        answeredBy: answeredBefore(text, questions, answeredWith),
      })),
      questions.map(({ subject }) => subject),
    );
  }
  return answered;
}

/**
 * Asks a plan's questions through the engine's statement prompt, all in one batch that refuses a
 * statement nothing consumed before the command acts. Flags answer first; where nobody can answer,
 * the engine refuses and lists every question. A `--delete` that names a namespace answers every
 * question about a model or field of it.
 */
export function promptPlanQuestions(
  prompt: PromptSurface,
  statements: StatementSurface,
): AnswerPlanQuestions {
  return async (questions): Promise<readonly PlanAnswer[]> => {
    const answered = namespaceDeletes(questions, statements) ?? new Map<number, PlanAnswer>();
    const asked = questions
      .map((question, index) => ({ question, index }))
      .filter(({ index }) => !answered.has(index));
    const answers = await prompt.statements(
      asked.map(({ question }) => ({
        question: question.question,
        subject: question.subject,
        verbs: question.verbs,
        forms: question.forms,
        validate: question.validate,
      })),
      { last: true },
    );
    const byIndex = new Map(answered);
    asked.forEach(({ index }, position) => {
      const answer = answers[position];
      if (answer !== undefined) byIndex.set(index, { verb: answer.verb, text: answer.text });
    });
    return questions.flatMap((_, index) => byIndex.get(index) ?? []);
  };
}

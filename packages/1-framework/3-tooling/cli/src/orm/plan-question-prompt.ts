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

function engineQuestion(question: PlanQuestion) {
  return {
    question: question.question,
    subject: question.subject,
    verbs: question.verbs,
    forms: question.forms,
    validate: question.validate,
  };
}

/** Whether an answer is the namespace's own: a `delete` of it, or a `rename` of it. */
function answersNamespace(answer: PlanAnswer, namespace: string): boolean {
  return answer.verb === 'delete'
    ? answer.text === namespace
    : answer.verb === 'rename' && answer.text.startsWith(`${namespace}:`);
}

function isConsentRequired(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'CLI.CONSENT_REQUIRED'
  );
}

/**
 * Asks the questions one at a time, so an answer typed for a namespace the destination removed, a
 * `delete` or a `rename` of it, answers the rest of that namespace's questions without asking them.
 * When nobody can answer a question, the engine is asked every question still open at once, so its
 * refusal names them all.
 */
async function askOneAtATime(
  prompt: PromptSurface,
  asked: readonly { readonly question: PlanQuestion; readonly index: number }[],
): Promise<ReadonlyMap<number, PlanAnswer>> {
  const answered = new Map<number, PlanAnswer>();
  const namespaceAnswers = new Map<string, PlanAnswer>();
  for (const [position, { question, index }] of asked.entries()) {
    const { removedNamespace } = question;
    const given =
      removedNamespace === undefined ? undefined : namespaceAnswers.get(removedNamespace);
    if (given !== undefined) {
      answered.set(index, given);
      continue;
    }
    const [typed] = await prompt
      .statements([engineQuestion(question)])
      .catch(async (error: unknown) => {
        if (!isConsentRequired(error)) throw error;
        await prompt.statements(
          asked.slice(position).map(({ question: open }) => engineQuestion(open)),
          { last: true },
        );
        throw error;
      });
    if (typed === undefined) continue;
    const answer: PlanAnswer = { verb: typed.verb, text: typed.text };
    answered.set(index, answer);
    if (removedNamespace !== undefined && answersNamespace(answer, removedNamespace)) {
      namespaceAnswers.set(removedNamespace, answer);
    }
  }
  await prompt.statements([], { last: true });
  return answered;
}

/**
 * Asks a plan's questions through the engine's statement prompt. Flags answer first; where nobody
 * can answer, the engine refuses and lists every question. A `--delete` that names a namespace
 * answers every question about a model or field of it, and so does a `delete` or `rename` of the
 * namespace typed at the prompt. Without such a namespace, the questions are asked in one batch
 * that refuses a statement nothing consumed before the command acts.
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
    const byIndex = new Map(answered);
    if (asked.some(({ question }) => question.removedNamespace !== undefined)) {
      for (const [index, answer] of await askOneAtATime(prompt, asked)) byIndex.set(index, answer);
    } else {
      const answers = await prompt.statements(
        asked.map(({ question }) => engineQuestion(question)),
        { last: true },
      );
      asked.forEach(({ index }, position) => {
        const answer = answers[position];
        if (answer !== undefined) byIndex.set(index, { verb: answer.verb, text: answer.text });
      });
    }
    return questions.flatMap((_, index) => byIndex.get(index) ?? []);
  };
}

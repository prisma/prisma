import type { ContractWithDomain } from '@internal/contract/types';
import type { CliStructuredError } from '@internal/errors/control';
import {
  type FieldCoordinate,
  fieldStatementText,
  type MigrationDataLossKind,
  type MigrationPlanNamespaces,
  type MigrationSubject,
  type ModelCoordinate,
  migrationSubjectKey,
  modelStatementText,
  type ResolvedMigrationStatement,
} from '@internal/framework-components/control';
import { InternalError } from '@internal/utils/internal-error';
import { notOk, ok, type Result } from '@internal/utils/result';
import {
  errorConsentUnused,
  errorStatementAnswersNoQuestion,
  errorStatementDidNotResolveLoss,
  STORE_ORIGIN_SNAPSHOT_STEPS,
  type UnusedConsent,
} from '../../utils/cli-errors';
import type { ConsentVerb } from './parse-consent';
import { resolveStatements } from './resolve-statements';
import { statementFlag } from './statement-flag';
import { isPlannedStatement, type StatementText } from './statement-text';

/** A verb a plan question accepts. */
export type PlanQuestionVerb = 'rename' | 'convert' | ConsentVerb;

/**
 * What a command asks about one operation of a plan: the question, its subject written as the
 * statement names it, and the verbs that answer it. A command hands it to its prompt.
 */
export interface PlanQuestion {
  readonly question: string;
  readonly subject: string;
  /** The namespace of a data-loss question's model or field when the destination removed it: a `delete` of it answers the question too. */
  readonly removedNamespace?: string;
  readonly verbs: readonly PlanQuestionVerb[];
  readonly forms: { readonly rename?: string; readonly convert?: string };
  readonly validate: (verb: PlanQuestionVerb, text: string) => string | undefined;
}

export interface PlanAnswer {
  readonly verb: PlanQuestionVerb;
  readonly text: string;
}

/**
 * Asks every question at once and returns one answer per question, in question order, with a verb
 * and text the question accepts. To refuse, throw. It is called at least once per apply, with an
 * empty list when nothing is in question, including under `acceptDataLoss: true`; return `[]`
 * then. Beside a `rename` or `convert` answer, which plans again, a question may be left
 * `undefined`: it is asked again, as the new plan has it.
 */
export type AnswerPlanQuestions = (
  questions: readonly PlanQuestion[],
) => Promise<readonly (PlanAnswer | undefined)[]>;

/**
 * An operation of a plan with its subject and the label of that operation. `operationIndex` is
 * its position among the operations the result lists; `undefined` when the plan could not resolve
 * it.
 */
export interface PlannedSubject {
  readonly operationIndex: number | undefined;
  readonly label: string;
  readonly subject: MigrationSubject;
}

/** An operation of a plan that loses its subject's data, how, and how to keep the data instead. */
export interface PlannedDataLoss extends PlannedSubject {
  readonly loss: MigrationDataLossKind | undefined;
  /** How to keep the data instead, in the target's words; the question ends with it. */
  readonly keepDataAdvice?: string;
}

/** An operation of a plan that changes who can read or write its subject's data. */
export interface PlannedAccessChange extends PlannedSubject {
  readonly widens: boolean;
}

/** What a plan would lose, and whose access it would change. */
export interface PlannedQuestions {
  readonly dataLoss: readonly PlannedDataLoss[];
  readonly accessChanges: readonly PlannedAccessChange[];
  /** The namespaces the planner removes and adds; absent when it reports none. */
  readonly namespaces?: MigrationPlanNamespaces;
}

/** The contracts a statement names things in, and the statements the plan carries out so far. */
export interface StatementContracts {
  readonly origin: ContractWithDomain;
  /** The destination contract; needed only to name a field of a renamed model. */
  readonly destination?: ContractWithDomain;
  /** The rename, convert and backfill statements the plan carries out, in the order given. */
  readonly statements: readonly StatementText[];
}

/** The plan's renames, resolved; empty when there are none or they do not resolve. */
function resolvedRenames(contracts: StatementContracts): readonly ResolvedMigrationStatement[] {
  const renames = contracts.statements.filter((statement) => statement.verb === 'rename');
  if (contracts.destination === undefined || renames.length === 0) return [];
  const resolved = resolveStatements({
    statements: renames,
    origin: { kind: 'contract', contract: contracts.origin },
    destination: contracts.destination,
  });
  return resolved.ok ? resolved.value : [];
}

function sameModel(left: ModelCoordinate, right: ModelCoordinate): boolean {
  return left.namespaceId === right.namespaceId && left.model === right.model;
}

/**
 * The model a rename statement of `contracts` gives `coordinate` in the destination, if any: a
 * rename of the model, or else a rename of its namespace, under which the model keeps its name when
 * the destination has it there.
 */
function renamedModel(
  coordinate: ModelCoordinate,
  contracts: StatementContracts,
): ModelCoordinate | undefined {
  const renames = resolvedRenames(contracts);
  for (const statement of renames) {
    if (
      statement.kind === 'rename' &&
      statement.entity === 'model' &&
      sameModel(statement.from, coordinate)
    ) {
      return statement.to;
    }
  }
  for (const statement of renames) {
    if (
      statement.kind === 'rename' &&
      statement.entity === 'namespace' &&
      statement.from === coordinate.namespaceId
    ) {
      const moved = { namespaceId: statement.to, model: coordinate.model };
      const destinationHas =
        contracts.destination?.domain.namespaces[moved.namespaceId]?.models[moved.model] !==
        undefined;
      return destinationHas ? moved : undefined;
    }
  }
  return undefined;
}

/** The field of the origin contract at `coordinate`, as the destination names it after the plan's renames. */
function destinationField(
  coordinate: FieldCoordinate,
  contracts: StatementContracts,
): FieldCoordinate {
  for (const statement of resolvedRenames(contracts)) {
    if (
      statement.kind === 'rename' &&
      statement.entity === 'field' &&
      sameModel(statement.from, coordinate) &&
      statement.from.field === coordinate.field
    ) {
      return statement.to;
    }
  }
  return { ...(renamedModel(coordinate, contracts) ?? coordinate), field: coordinate.field };
}

/**
 * The subject as a statement names it: `Model` or `Model.field`, with the namespace when its
 * contract has several, or the storage name when no model stores what the operation is about. A
 * model the plan renames or moves, and a field of it, are named through the model's new name, as a
 * rename of the field is written.
 */
export function subjectText(subject: MigrationSubject, contracts: StatementContracts): string {
  switch (subject.kind) {
    case 'model': {
      const renamed = renamedModel(subject, contracts);
      return renamed === undefined || contracts.destination === undefined
        ? modelStatementText(contracts.origin, subject)
        : modelStatementText(contracts.destination, renamed);
    }
    case 'field': {
      const renamed = renamedModel(subject, contracts);
      const model =
        renamed === undefined || contracts.destination === undefined
          ? modelStatementText(contracts.origin, subject)
          : modelStatementText(contracts.destination, renamed);
      return `${model}.${subject.field}`;
    }
    case 'storage':
      return subject.name;
  }
}

/**
 * The statement's description, written as its question names the subject: `delete field
 * "User.nickname"`, or `accept lossy type change of field "User.age"` for a delete that answers a
 * type change, which keeps the field and lets the database cast its values, cutting or rounding some.
 */
export function consentDescription(
  verb: ConsentVerb,
  subject: MigrationSubject,
  text: string,
  loss: MigrationDataLossKind | undefined,
): string {
  return verb === 'delete' && loss === 'typeChange'
    ? `accept lossy type change of ${subject.kind} "${text}"`
    : `${verb} ${subject.kind} "${text}"`;
}

function lossText(
  subject: MigrationSubject,
  text: string,
  originKnown: boolean,
  loss: MigrationDataLossKind | undefined,
): string {
  switch (subject.kind) {
    case 'model':
      return `would lose the data of model "${text}"`;
    case 'field':
      return loss === 'typeChange'
        ? `would change the type of field "${text}" and can change or lose its values`
        : `would lose the values of field "${text}"`;
    case 'storage':
      return originKnown
        ? `would lose the data in "${text}", which no model of the origin contract stores`
        : `would lose the data in "${text}", named by its storage name because the origin contract is unknown; --delete loses that data`;
  }
}

/**
 * How to keep the data of a storage subject that was renamed, when the origin contract is unknown:
 * store the snapshot of the contract the database is at, as `MIGRATION.STATEMENT_ORIGIN_UNKNOWN`
 * advises, then answer with a rename. The refusal gives it once, on its first storage question. The
 * engine does not put the CLI's name in a question's text, so the steps name `prisma`.
 */
export const ORIGIN_SNAPSHOT_RECOVERY = [
  'If it was renamed, keep its data instead: store the snapshot of the contract the database is at, then run this command again and answer with --rename.',
  ...STORE_ORIGIN_SNAPSHOT_STEPS.map((step) => step.replaceAll('{bin}', 'prisma')),
].join('\n');

function sameCoordinate(statement: ResolvedMigrationStatement, subject: MigrationSubject): boolean {
  if (statement.kind !== 'rename' || statement.entity === 'namespace' || subject.kind === 'storage')
    return false;
  const { from } = statement;
  if (from.namespaceId !== subject.namespaceId || from.model !== subject.model) return false;
  return subject.kind === 'field'
    ? statement.entity === 'field' && statement.from.field === subject.field
    : statement.entity === 'model';
}

function namesSubject(verb: ConsentVerb, subject: string) {
  return (text: string): string | undefined =>
    text === subject ? undefined : `${verb} names "${subject}": --${verb} ${subject}.`;
}

function modelRenameAdvice(model: ModelCoordinate, contracts: StatementContracts): string {
  const name = modelStatementText(contracts.origin, model);
  return `The destination contract has no model "${name}"; to keep the values instead, also pass --rename ${name}:<new model name>, naming the model that stores them now, and the question then offers to rename the field.`;
}

/** A rename as a statement is written: a field's new name keeps the model, `User.nickname:User.<new name>`. */
function renameForm(subject: MigrationSubject, text: string): string {
  return subject.kind === 'field'
    ? `${text}:${text.slice(0, text.lastIndexOf('.'))}.<new name>`
    : `${text}:<new name>`;
}

/** Whether a rename statement of the plan already gives the subject a new name. */
function renamedByPlan(subject: MigrationSubject, contracts: StatementContracts): boolean {
  if (subject.kind === 'storage') return false;
  return resolvedRenames(contracts).some((statement) => sameCoordinate(statement, subject));
}

/** Whether the destination still has the subject's model or field, under the name a rename gives it. */
function inDestination(
  subject: MigrationSubject,
  contracts: StatementContracts & { readonly destination: ContractWithDomain },
): boolean {
  if (subject.kind === 'storage') return false;
  const model = renamedModel(subject, contracts) ?? subject;
  const destinationModel =
    contracts.destination.domain.namespaces[model.namespaceId]?.models[model.model];
  if (destinationModel === undefined) return false;
  return subject.kind === 'model' || Object.hasOwn(destinationModel.fields, subject.field);
}

/** Checks a statement typed at a question against the plan's other statements. */
function resolvesWith(
  statement: StatementText,
  contracts: StatementContracts & { readonly destination: ContractWithDomain },
): Result<ResolvedMigrationStatement | undefined, string> {
  const resolved = resolveStatements({
    statements: [...contracts.statements, statement],
    origin: { kind: 'contract', contract: contracts.origin },
    destination: contracts.destination,
  });
  if (!resolved.ok)
    return notOk(`${resolved.failure.message}. ${resolved.failure.why ?? ''}`.trim());
  return ok(resolved.value.at(-1));
}

type DataLossContracts = StatementContracts & {
  readonly destination: ContractWithDomain;
  readonly originKnown: boolean;
  /** Whether the command writes a migration whose conversion the user fills in. */
  readonly canConvert: boolean;
};

/**
 * The model of a field subject, under the name a rename of the plan gives it, when the destination
 * has no model of that name: a rename of the field cannot be written until a statement renames the
 * model.
 */
function missingFieldModel(
  subject: MigrationSubject,
  contracts: StatementContracts & { readonly destination: ContractWithDomain },
): ModelCoordinate | undefined {
  if (subject.kind !== 'field') return undefined;
  const model = renamedModel(subject, contracts) ?? subject;
  return contracts.destination.domain.namespaces[model.namespaceId]?.models[model.model] ===
    undefined
    ? model
    : undefined;
}

/**
 * The question for one operation that would lose data. A field whose type changes may be converted
 * where the command writes a migration to fill in; the convert names the field as the destination
 * names it. A model or field the destination no longer has, and no rename of the plan renamed, may
 * be renamed instead of deleted; a rename is resolved against the two contracts after the plan's
 * other renames, and its old name must be the subject. Anything else, and data no model stores,
 * can only be deleted. A field whose model the destination names differently can be renamed only
 * after a statement renames the model, so the question says to pass one. The question ends with
 * the planner's advice on keeping the data, when it gives any.
 */
export function dataLossQuestion(
  loss: PlannedDataLoss,
  contracts: DataLossContracts,
): PlanQuestion {
  const subject = subjectText(loss.subject, contracts);
  const deleteNames = namesSubject('delete', subject);
  const missingModel = missingFieldModel(loss.subject, contracts);
  const question = [
    `${loss.label} ${lossText(loss.subject, subject, contracts.originKnown, loss.loss)}.`,
    ...(missingModel === undefined ? [] : [modelRenameAdvice(missingModel, contracts)]),
    ...(loss.keepDataAdvice === undefined ? [] : [loss.keepDataAdvice]),
  ].join(' ');
  if (loss.loss === 'typeChange' && loss.subject.kind === 'field') {
    if (!contracts.canConvert) {
      return {
        question,
        subject,
        verbs: ['delete'],
        forms: {},
        validate: (_verb, text) => deleteNames(text),
      };
    }
    const field = destinationField(loss.subject, contracts);
    const convert = fieldStatementText(contracts.destination, field);
    return {
      question,
      subject,
      verbs: ['convert', 'delete'],
      forms: { convert },
      validate: (verb, text) => {
        if (verb !== 'convert') return deleteNames(text);
        if (text !== convert) {
          return `convert names the field as the destination contract names it: ${statementFlag({ verb: 'convert', text: convert })}.`;
        }
        const resolved = resolvesWith({ verb: 'convert', text }, contracts);
        return resolved.ok ? undefined : resolved.failure;
      },
    };
  }
  const renamable =
    missingModel === undefined &&
    loss.subject.kind !== 'storage' &&
    !inDestination(loss.subject, contracts) &&
    !renamedByPlan(loss.subject, contracts);
  return {
    question,
    subject,
    verbs: renamable ? ['rename', 'delete'] : ['delete'],
    forms: renamable ? { rename: renameForm(loss.subject, subject) } : {},
    validate: (verb, text) => {
      if (verb !== 'rename') return deleteNames(text);
      const resolved = resolvesWith({ verb: 'rename', text }, contracts);
      if (!resolved.ok) return resolved.failure;
      return resolved.value !== undefined && sameCoordinate(resolved.value, loss.subject)
        ? undefined
        : `The rename's old name is not "${subject}". Write it as ${renameForm(loss.subject, subject)}.`;
    },
  };
}

/**
 * The question for one operation that changes who can read or write its subject's data: it widens
 * access, or changes it in a way that can go either way. Each such operation is its own question,
 * answered by its own `allow`.
 */
export function accessChangeQuestion(
  change: PlannedAccessChange,
  contracts: StatementContracts,
): PlanQuestion {
  const subject = subjectText(change.subject, contracts);
  return {
    question: `${change.label} would ${change.widens ? 'widen' : 'change'} who can read and write its data.`,
    subject,
    verbs: ['allow'],
    forms: {},
    validate: (_verb, text) => namesSubject('allow', subject)(text),
  };
}

/** A subject the user consented to, with the statement's text as its question wrote it. */
export interface ConsentedSubject {
  readonly verb: ConsentVerb;
  readonly subject: MigrationSubject;
  readonly text: string;
  /** The position of the operation an `allow` consented to; a `delete` covers every loss of its subject. */
  readonly operationIndex: number | undefined;
  /** How the operations a `delete` answered lose the data; `undefined` for an `allow`. */
  readonly loss: MigrationDataLossKind | undefined;
}

const keyOf = (planned: PlannedSubject) => migrationSubjectKey(planned.subject);

/**
 * The namespace of the model or field a subject names, when the planner removes that namespace: a
 * `delete` of the namespace answers the question too.
 */
export function removedNamespaceOf(
  subject: MigrationSubject,
  namespaces: MigrationPlanNamespaces | undefined,
): string | undefined {
  if (subject.kind === 'storage') return undefined;
  return namespaces?.removed.includes(subject.namespaceId) === true
    ? subject.namespaceId
    : undefined;
}

/** A question as a consent statement can answer it: by its subject, or by a namespace the destination removed. */
export interface ConsentTarget {
  readonly text: string;
  readonly removedNamespace: string | undefined;
}

/**
 * Whether a `delete` or `allow` statement with `text` answers a question: it names the subject, or,
 * for a `delete`, the namespace the destination removed. Every place that matches a consent flag to
 * a question asks this.
 */
export function consentAnswers(verb: ConsentVerb, text: string, target: ConsentTarget): boolean {
  return (
    text === target.text ||
    (verb === 'delete' && target.removedNamespace !== undefined && text === target.removedNamespace)
  );
}

/**
 * The pre-answers that answer a question: every `delete` that answers it, or the first `allow` of
 * it no earlier question took, since an `allow` answers one operation.
 */
function givenFor(
  verb: ConsentVerb,
  target: ConsentTarget,
  preAnswers: readonly StatementText[],
  taken: ReadonlySet<StatementText>,
): readonly StatementText[] {
  const matching = preAnswers.filter(
    (statement) => statement.verb === verb && consentAnswers(verb, statement.text, target),
  );
  if (verb === 'delete') return matching;
  const first = matching.find((statement) => !taken.has(statement));
  return first === undefined ? [] : [first];
}

/**
 * A `delete` answers for its subject; an `allow` for its one operation, known by its label and
 * subject, since a re-plan moves every operation's position.
 */
function questionKey(verb: ConsentVerb, entry: PlannedSubject): string {
  return verb === 'allow' ? `allow:${entry.label}:${keyOf(entry)}` : `delete:${keyOf(entry)}`;
}

function checkAnswers(
  questions: readonly PlanQuestion[],
  answers: readonly (PlanAnswer | undefined)[],
): void {
  const plansAgain = answers.some(
    (answer) => answer?.verb === 'rename' || answer?.verb === 'convert',
  );
  const open = answers.findIndex((answer) => answer === undefined);
  if (open !== -1 && !plansAgain) {
    throw new InternalError(
      `answerQuestions left "${questions[open]?.question}" open, which it may do only beside a rename or convert answer that plans again.`,
      { cause: { questions: questions.map(({ subject }) => subject), answers } },
    );
  }
  if (answers.length !== questions.length) {
    const noun = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;
    throw new InternalError(
      `answerQuestions gave ${noun(answers.length, 'answer')} for ${noun(questions.length, 'question')}; answer each question in order, or throw to refuse.`,
      { cause: { questions: questions.map(({ subject }) => subject), answers } },
    );
  }
  questions.forEach((question, index) => {
    const answer = answers[index];
    if (answer === undefined) return;
    const cause = { cause: { question: question.subject, verbs: question.verbs, answer } };
    if (!question.verbs.includes(answer.verb)) {
      throw new InternalError(
        `answerQuestions answered "${question.question}" with ${answer.verb}, which it does not accept; it accepts ${question.verbs.join(' or ')}.`,
        cause,
      );
    }
    const rejected = question.validate(answer.verb, answer.text);
    if (rejected !== undefined) {
      throw new InternalError(
        `answerQuestions answered "${question.question}" wrongly: ${rejected}`,
        cause,
      );
    }
  });
}

function namespaceRenameAdvice(removed: string, added: readonly string[]): string | undefined {
  const [only] = added;
  if (only === undefined) return undefined;
  const lead = `If namespace "${removed}" was renamed, --rename ${removed}:`;
  if (added.length === 1) return `${lead}${only} renames it instead.`;
  const choices = `${added.slice(0, -1).join(', ')} or ${added.at(-1)}`;
  return `${lead}<new namespace> renames it instead, where <new namespace> is ${choices}.`;
}

/**
 * The first question about a model or field of a namespace the destination contract no longer has
 * says that a `delete` of the namespace answers every question about it, and, when the destination
 * adds a namespace, how to rename the namespace instead.
 */
function withNamespaceDeleteOnFirstQuestion(
  questions: readonly PlanQuestion[],
  added: readonly string[],
): readonly PlanQuestion[] {
  const told = new Set<string>();
  return questions.map((question) => {
    const { removedNamespace } = question;
    if (removedNamespace === undefined || told.has(removedNamespace)) return question;
    told.add(removedNamespace);
    const lines = [
      question.question,
      `--delete ${removedNamespace} answers this question and every other about a model or field of namespace "${removedNamespace}", which the destination contract no longer has.`,
      namespaceRenameAdvice(removedNamespace, added),
    ];
    return { ...question, question: lines.filter((line) => line !== undefined).join('\n') };
  });
}

/**
 * A question about a model or field of a namespace the destination removed, which also accepts the
 * namespace's own answers: a `delete` of the namespace, or a `rename` of it to another one.
 */
function acceptingNamespaceAnswers(
  question: PlanQuestion,
  removedNamespace: string | undefined,
  contracts: StatementContracts & { readonly destination: ContractWithDomain },
): PlanQuestion {
  if (removedNamespace === undefined) return question;
  const answersNamespace = (verb: PlanQuestionVerb, text: string): boolean => {
    if (verb === 'delete') return text === removedNamespace;
    if (verb !== 'rename') return false;
    const resolved = resolvesWith({ verb, text }, contracts);
    return (
      resolved.ok &&
      resolved.value?.kind === 'rename' &&
      resolved.value.entity === 'namespace' &&
      resolved.value.from === removedNamespace
    );
  };
  return {
    ...question,
    removedNamespace,
    validate: (verb, text) =>
      answersNamespace(verb, text) ? undefined : question.validate(verb, text),
  };
}

function withRecoveryOnFirstStorageQuestion(
  asked: readonly { readonly loss: PlannedDataLoss; readonly question: PlanQuestion }[],
  recoveryApplies: boolean,
): readonly PlanQuestion[] {
  const first = recoveryApplies
    ? asked.findIndex(({ loss }) => loss.subject.kind === 'storage')
    : -1;
  return asked.map(({ question }, index) =>
    index === first
      ? { ...question, question: `${question.question}\n${ORIGIN_SNAPSHOT_RECOVERY}` }
      : question,
  );
}

/**
 * Asks about every operation of a plan that would lose data and, when `askAccess`, every one that
 * would change access, until each is answered. A `delete` or `allow` text in `preAnswers`, or
 * `consentAll` for its verb, answers its question without asking. A rename or convert typed at the
 * prompt is a statement the plan did not have, so the plan is made again with every statement, and
 * the operation it answered must be gone; a loss the new plan has on the same subject, such as a
 * type change on the renamed field, is asked in the next round. The first round asks even when
 * nothing is in question, so a statement no question consumed is refused before anything is done.
 */
export async function askPlanQuestions<TPlan extends PlannedQuestions, TFailure>(input: {
  readonly plan: TPlan;
  readonly askAccess: boolean;
  /** Whether a type change may be answered with `convert`: the command writes a migration to fill in. */
  readonly canConvert: boolean;
  /** The rename, convert and backfill statements the plan carries out, in the order given. */
  readonly statements: readonly StatementText[];
  readonly preAnswers: readonly StatementText[];
  readonly consentAll: { readonly [verb in ConsentVerb]: boolean };
  readonly origin: ContractWithDomain;
  readonly originKnown: boolean;
  readonly destination: ContractWithDomain;
  readonly answer: AnswerPlanQuestions;
  readonly replan: (statements: readonly StatementText[]) => Promise<Result<TPlan, TFailure>>;
}): Promise<
  Result<
    {
      readonly plan: TPlan;
      readonly statements: readonly StatementText[];
      readonly consented: readonly ConsentedSubject[];
    },
    TFailure | CliStructuredError
  >
> {
  let plan = input.plan;
  let statements = input.statements;
  const consented = new Map<string, ConsentedSubject>();
  const usedPreAnswers = new Set<StatementText>();
  for (let round = 0; ; round += 1) {
    const contracts = {
      origin: input.origin,
      originKnown: input.originKnown,
      destination: input.destination,
      canConvert: input.canConvert,
      statements,
    };
    const pending = <TEntry extends PlannedSubject>(
      verb: ConsentVerb,
      planned: readonly TEntry[],
    ): readonly TEntry[] => [
      ...new Map(
        planned
          .filter((entry) => !consented.has(questionKey(verb, entry)))
          .map((entry) => [questionKey(verb, entry), entry]),
      ).values(),
    ];
    const consent = (verb: ConsentVerb, entry: PlannedSubject | PlannedDataLoss, text: string) =>
      consented.set(questionKey(verb, entry), {
        verb,
        subject: entry.subject,
        text,
        operationIndex: entry.operationIndex,
        loss: verb === 'delete' && 'loss' in entry ? entry.loss : undefined,
      });
    for (const [verb, entries] of [
      ['delete', pending('delete', plan.dataLoss)],
      ['allow', input.askAccess ? pending('allow', plan.accessChanges) : []],
    ] as const) {
      for (const entry of entries) {
        const text = subjectText(entry.subject, contracts);
        const given = givenFor(
          verb,
          { text, removedNamespace: removedNamespaceOf(entry.subject, plan.namespaces) },
          input.preAnswers,
          usedPreAnswers,
        );
        for (const statement of given) usedPreAnswers.add(statement);
        if (input.consentAll[verb] || given.length > 0) consent(verb, entry, text);
      }
    }
    const losses = pending('delete', plan.dataLoss);
    const accessChanges = input.askAccess ? pending('allow', plan.accessChanges) : [];
    if (losses.length + accessChanges.length === 0 && round > 0) break;
    const questions = [
      ...withNamespaceDeleteOnFirstQuestion(
        withRecoveryOnFirstStorageQuestion(
          losses.map((loss) => ({
            loss,
            question: acceptingNamespaceAnswers(
              dataLossQuestion(loss, contracts),
              removedNamespaceOf(loss.subject, plan.namespaces),
              contracts,
            ),
          })),
          !input.originKnown,
        ),
        plan.namespaces?.added ?? [],
      ),
      ...accessChanges.map((change) => accessChangeQuestion(change, contracts)),
    ];
    const answers = await input.answer(questions);
    checkAnswers(questions, answers);
    const typed: {
      readonly statement: StatementText;
      readonly loss: PlannedSubject;
      readonly ofNamespace: boolean;
    }[] = [];
    answers.forEach((answer, index) => {
      const entry = [...losses, ...accessChanges][index];
      const question = questions[index];
      if (answer === undefined || entry === undefined || question === undefined) return;
      if (answer.verb === 'rename' || answer.verb === 'convert') {
        typed.push({
          statement: { verb: answer.verb, text: answer.text },
          loss: entry,
          ofNamespace:
            question.removedNamespace !== undefined &&
            answer.text.startsWith(`${question.removedNamespace}:`),
        });
      } else consent(answer.verb, entry, question.subject);
    });
    if (typed.length === 0) {
      if (losses.length + accessChanges.length === 0) break;
      continue;
    }
    const given = new Set(statements.map(({ verb, text }) => `${verb} ${text}`));
    for (const { statement } of typed) {
      const key = `${statement.verb} ${statement.text}`;
      if (given.has(key)) continue;
      given.add(key);
      statements = [...statements, statement];
    }
    const replanned = await input.replan(statements);
    if (!replanned.ok) return replanned;
    plan = replanned.value;
    for (const entry of plan.accessChanges) {
      const allowed = consented.get(questionKey('allow', entry));
      if (allowed !== undefined) {
        consented.set(questionKey('allow', entry), {
          ...allowed,
          operationIndex: entry.operationIndex,
        });
      }
    }
    const operationOf = (entry: PlannedSubject) => `${entry.label}:${keyOf(entry)}`;
    const stillPlanned = new Set(plan.dataLoss.map(operationOf));
    const unresolved = typed.find(
      ({ loss, ofNamespace }) => !ofNamespace && stillPlanned.has(operationOf(loss)),
    );
    if (unresolved !== undefined) {
      return notOk(
        errorStatementDidNotResolveLoss(
          unresolved.statement,
          subjectText(unresolved.loss.subject, contracts),
        ),
      );
    }
  }
  const unused = input.preAnswers.filter((statement) => !usedPreAnswers.has(statement));
  if (unused.length > 0) {
    return notOk(
      errorStatementAnswersNoQuestion(
        unused,
        questionSubjects(plan, input.askAccess, { ...input, statements }),
      ),
    );
  }
  return ok({ plan, statements, consented: [...consented.values()] });
}

function questionSubjects(
  plan: PlannedQuestions,
  askAccess: boolean,
  contracts: StatementContracts,
): readonly string[] {
  const subjects = [...plan.dataLoss, ...(askAccess ? plan.accessChanges : [])].map((entry) =>
    subjectText(entry.subject, contracts),
  );
  return [...new Set(subjects)];
}

/**
 * Refuses the `delete` and `allow` statements that name no subject a plan asks about, without
 * asking anything: a run that only plans still says which statements would consent to nothing.
 * The plan carries out its other statements, so they are not checked here.
 */
export function refuseUnusedConsents(input: {
  readonly plan: PlannedQuestions;
  readonly statements: readonly StatementText[];
  readonly contracts: StatementContracts;
}): Result<void, CliStructuredError> {
  const subjects = questionSubjects(input.plan, true, input.contracts);
  const used = new Set<StatementText>();
  for (const entry of input.plan.accessChanges) {
    const target = {
      text: subjectText(entry.subject, input.contracts),
      removedNamespace: undefined,
    };
    for (const statement of givenFor('allow', target, input.statements, used)) used.add(statement);
  }
  const deleteTargets = [
    ...new Map(
      input.plan.dataLoss.map((entry) => {
        const text = subjectText(entry.subject, input.contracts);
        return [
          text,
          { text, removedNamespace: removedNamespaceOf(entry.subject, input.plan.namespaces) },
        ];
      }),
    ).values(),
  ];
  const deletes = input.statements.filter(({ verb }) => verb === 'delete');
  const matched = matchDeletes(
    deleteTargets,
    deletes.map(({ text }) => text),
  );
  const duplicates = matched.unused.filter(({ answeredBy }) => answeredBy !== undefined);
  const unusedDeletes = new Set(matched.unused.map(({ text }) => text));
  for (const statement of deletes) if (!unusedDeletes.has(statement.text)) used.add(statement);
  const unused = input.statements.filter(
    (statement) =>
      !isPlannedStatement(statement) &&
      !used.has(statement) &&
      !duplicates.some(({ text }) => statement.verb === 'delete' && statement.text === text),
  );
  if (unused.length > 0) return notOk(errorStatementAnswersNoQuestion(unused, subjects));
  return duplicates.length === 0 ? ok(undefined) : notOk(errorConsentUnused(duplicates, subjects));
}

/** The questions `--delete` values answered, and the values no question took. */
export interface DeleteMatch {
  /** The value that answers each target, by the target's position. */
  readonly answered: ReadonlyMap<number, string>;
  readonly unused: readonly UnusedConsent[];
}

/**
 * Matches `--delete` values to questions as an apply does, one value per question: each question
 * takes the first value, in the order given, that answers it. A value no question took is unused,
 * and says which value had already answered its question, if one had. A dry run and an apply both
 * ask this, so they refuse the same flags.
 */
export function matchDeletes(
  targets: readonly ConsentTarget[],
  texts: readonly string[],
): DeleteMatch {
  const answered = new Map<number, string>();
  const answeredWith = new Map<string, string>();
  const used = new Set<number>();
  targets.forEach((target, index) => {
    const position = texts.findIndex((text) => consentAnswers('delete', text, target));
    const given = texts[position];
    if (given === undefined) return;
    used.add(position);
    answered.set(index, given);
    answeredWith.set(target.text, given);
  });
  const unused = texts
    .filter((_, position) => !used.has(position))
    .map((text): UnusedConsent => {
      const flag = answeredWith.get(text);
      return {
        verb: 'delete',
        text,
        answeredBy:
          flag !== undefined
            ? { kind: 'subject', subject: text, flag: { verb: 'delete', text: flag } }
            : targets.some(({ removedNamespace }) => removedNamespace === text)
              ? { kind: 'namespace', namespace: text }
              : undefined,
      };
    });
  return { answered, unused };
}

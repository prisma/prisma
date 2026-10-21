import type { MigrationRunnerFailure } from '@internal/framework-components/control';
import type { NextAction } from '@prisma/cli-engine/protocol';

/** One way out of a failed apply: the sentence that says it, without its period, and the action it is. */
export interface AdviceAlternative {
  readonly text: string;
  readonly action: NextAction;
}

/** What the CLI says about a failed apply: sentences that say where things stand, then each way out. */
export interface RunnerAdvice {
  readonly context: readonly string[];
  readonly alternatives: readonly AdviceAlternative[];
}

export function adviceOf(
  context: readonly string[],
  alternatives: readonly AdviceAlternative[],
): RunnerAdvice {
  return { context, alternatives };
}

/** A way out that runs `command`, among the other steps `text` names. */
export function commandAlternative(text: string, command: string): AdviceAlternative {
  return { text, action: { kind: 'run-command', label: text, command } };
}

/** A way out that changes a file. */
export function editAlternative(text: string): AdviceAlternative {
  return { text, action: { kind: 'edit-file', label: text } };
}

/** A way out the user decides on and carries out themselves. */
export function choiceAlternative(text: string): AdviceAlternative {
  return { text, action: { kind: 'user-choice', label: text } };
}

function orSentence(text: string): string {
  return `Or ${text.charAt(0).toLowerCase()}${text.slice(1)}.`;
}

/** The advice as prose: where things stand, the first way out, and every other one after "Or". */
export function adviceText(advice: RunnerAdvice): string {
  return [
    ...advice.context,
    ...advice.alternatives.map(({ text }, index) => (index === 0 ? `${text}.` : orSentence(text))),
  ].join(' ');
}

/** Each way out as a next action, with where things stand as its reason. */
export function adviceActions(advice: RunnerAdvice): readonly NextAction[] {
  const reason = advice.context.join(' ');
  return advice.alternatives.map(({ action }) => (reason === '' ? action : { ...action, reason }));
}

/** What the failed apply left in the database, as far as the runner says. */
export function applyOutcomeText(failure: MigrationRunnerFailure): string {
  switch (failure.meta.rolledBack) {
    case true:
      return 'The failed apply changed nothing.';
    case false:
      return 'The operations that ran before the failure stay applied.';
    default:
      return 'Operations that ran before the failure may stay applied.';
  }
}

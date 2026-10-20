import type { FailedCheck } from './control-migration-types';
import { type ExpectationFailureReason, issueOutcome, type SchemaDiffIssue } from './schema-diff';

const OUTCOME_LABEL: Record<ExpectationFailureReason, string> = {
  'not-found': 'missing',
  'not-expected': 'extra',
  'not-equal': 'mismatch',
};

/** What a diff issue says: its outcome, its path, and its explanation when it has one. */
export function issueLabel(issue: SchemaDiffIssue): string {
  const label = `${OUTCOME_LABEL[issueOutcome(issue)]}: ${issue.path.join('/')}`;
  return issue.explanation === undefined ? label : `${label}. ${issue.explanation.text}`;
}

/** The issues of a failed schema check, as one sentence after `opening`. */
export function schemaIssuesWhy(opening: string, issues: readonly SchemaDiffIssue[]): string {
  const labels = issues.map((issue) => issueLabel(issue).replace(/\.$/, ''));
  return `${opening}: ${labels.join('; ')}.`;
}

/** The why of a failed schema check after apply, listing its issues when it found any. */
export function schemaCheckWhy(issues: readonly SchemaDiffIssue[]): string {
  return issues.length === 0
    ? 'The resulting database schema does not satisfy the destination contract.'
    : schemaIssuesWhy('The schema check after apply found', issues);
}

/** What a check description says the operation expects: the named object `absent` from the database, or `present` in it. */
export interface CheckDescriptionReading {
  readonly expects: 'absent' | 'present';
  readonly object: string;
}

const ABSENT = /^(?:ensure )?(.+?) (?:does not (?:already )?exist|is missing)( on .+)?$/;
const ABSENT_FROM = /^(?:ensure )?(.+?) is absent from (.+)$/;
const PRESENT = /^(?:ensure )?(.+?) exists( on .+)?$/;

/**
 * Reads a check description, as the targets write it into an operation's precheck, for whether it expects an object absent or present: `ensure index "x" does not exist`, `ensure column "y" does not exist on "item"`, `collection users does not exist`, `ensure column "x" is missing` and `ensure value "b" is absent from enum type "Mood"` expect it absent; `ensure table "x" exists` and `index exists on users` present. Any other description, `undefined`.
 */
export function readCheckDescription(description: string): CheckDescriptionReading | undefined {
  const absent = ABSENT.exec(description);
  if (absent?.[1] !== undefined) {
    return { expects: 'absent', object: `${absent[1]}${absent[2] ?? ''}` };
  }
  const absentFrom = ABSENT_FROM.exec(description);
  if (absentFrom?.[1] !== undefined && absentFrom[2] !== undefined) {
    return { expects: 'absent', object: `${absentFrom[1]} in ${absentFrom[2]}` };
  }
  const present = PRESENT.exec(description);
  if (present?.[1] !== undefined) {
    return { expects: 'present', object: `${present[1]}${present[2] ?? ''}` };
  }
  return undefined;
}

/** What a failed check before an operation means: which check failed, and what that says of the database. */
export function failedPrecheckWhy(check: FailedCheck): string {
  const checked = `Before operation ${check.operationId} runs, it checks: ${check.description}.`;
  const reading = readCheckDescription(check.description);
  if (reading === undefined) return `${checked} That check failed on this database.`;
  return reading.expects === 'absent'
    ? `${checked} That check failed: the database already has ${reading.object}.`
    : `${checked} That check failed: the database has no ${reading.object}.`;
}

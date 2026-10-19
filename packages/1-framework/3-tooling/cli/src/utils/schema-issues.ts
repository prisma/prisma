import type {
  ExpectationFailureReason,
  SchemaDiffIssue,
} from '@internal/framework-components/control';
import { issueOutcome } from '@internal/framework-components/control';

const OUTCOME_LABEL: Record<ExpectationFailureReason, string> = {
  'not-found': 'missing',
  'not-expected': 'extra',
  'not-equal': 'mismatch',
};

/** What a diff issue says, in the words the commander shell used. */
export function issueLabel(issue: SchemaDiffIssue): string {
  const label = `${OUTCOME_LABEL[issueOutcome(issue)]}: ${issue.path.join('/')}`;
  return issue.explanation === undefined ? label : `${label}. ${issue.explanation.text}`;
}

/** The issues of a failed schema check, as one sentence for a diagnostic's why, after `opening`. */
export function schemaIssuesWhy(opening: string, issues: readonly SchemaDiffIssue[]): string {
  const labels = issues.map((issue) => issueLabel(issue).replace(/\.$/, ''));
  return `${opening}: ${labels.join('; ')}.`;
}

/** The why of a failed schema check after apply, listing its issues as `db verify` does; `undefined` when it found none. */
export function schemaCheckWhy(issues: readonly SchemaDiffIssue[] | undefined): string | undefined {
  return issues === undefined || issues.length === 0
    ? undefined
    : schemaIssuesWhy('The schema check after apply found', issues);
}

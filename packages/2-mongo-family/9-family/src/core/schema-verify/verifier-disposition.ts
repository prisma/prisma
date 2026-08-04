import type { ControlPolicy } from '@internal/contract/types';
import type {
  SchemaDiffIssue,
  VerifierIssueCategory,
  VerifierOutcome,
} from '@internal/framework-components/control';
import { dispositionForCategory, issueOutcome } from '@internal/framework-components/control';

/**
 * Classifies a Mongo schema-diff issue into the target-neutral categories the
 * framework grades. Mongo issues carry their coordinate as `path`
 * (`[collectionName]` for a whole collection, `[collectionName, auxiliary]`
 * for an index/validator/options finding), so a `not-expected` issue at
 * depth 1 is an undeclared whole collection and anything deeper is an
 * undeclared auxiliary. Mongo owns this mapping rather than importing the
 * SQL classifier — the two families share only the framework's category
 * grading.
 */
export function classifyMongoDiffIssue(issue: SchemaDiffIssue): VerifierIssueCategory {
  if (issueOutcome(issue) === 'not-found') {
    return 'declaredMissing';
  }
  if (issueOutcome(issue) === 'not-expected') {
    return issue.path.length <= 1 ? 'extraTopLevelObject' : 'extraAuxiliary';
  }
  return 'declaredIncompatible';
}

export function verifierDisposition(
  controlPolicy: ControlPolicy,
  issue: SchemaDiffIssue,
): VerifierOutcome {
  return dispositionForCategory(controlPolicy, classifyMongoDiffIssue(issue));
}

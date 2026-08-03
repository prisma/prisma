import type { ControlPolicy } from '@internal/contract/types';

export type VerificationStatus = 'pass' | 'warn' | 'fail';

export type VerifierOutcome = VerificationStatus | 'suppress';

/**
 * Target-neutral classification of a verifier finding, abstracted away from any
 * one storage model's vocabulary. Each family classifies its own concrete issue
 * kinds into these categories; the framework only grades the category against a
 * control policy.
 *
 * - `declaredMissing` — a declared object/element is absent from the database.
 * - `declaredIncompatible` — a declared object/element exists but its shape diverges.
 * - `valueDrift` — the value set of an existing type drifted (e.g. enum values).
 * - `extraNestedElement` — an undeclared element nested inside a declared object
 *   (a SQL column, a document field).
 * - `extraAuxiliary` — an undeclared auxiliary attached to a declared object
 *   (a SQL constraint/index, a Mongo index/validator).
 * - `extraTopLevelObject` — an undeclared top-level object (a SQL table, a
 *   Mongo collection).
 */
export type VerifierIssueCategory =
  | 'declaredMissing'
  | 'declaredIncompatible'
  | 'valueDrift'
  | 'extraNestedElement'
  | 'extraAuxiliary'
  | 'extraTopLevelObject';

/**
 * Grades a target-neutral issue category against a control policy.
 *
 * - `observed` warns on everything.
 * - `tolerated` suppresses only an extra nested element (everything else fails).
 * - `external` suppresses every extra category and value drift (existence and
 *   declared-shape divergences still fail).
 * - `managed` (and any other) fails.
 */
export function dispositionForCategory(
  controlPolicy: ControlPolicy,
  category: VerifierIssueCategory,
): VerifierOutcome {
  if (controlPolicy === 'observed') {
    return 'warn';
  }
  if (controlPolicy === 'tolerated' && category === 'extraNestedElement') {
    return 'suppress';
  }
  if (controlPolicy === 'external') {
    if (
      category === 'extraNestedElement' ||
      category === 'extraAuxiliary' ||
      category === 'extraTopLevelObject' ||
      category === 'valueDrift'
    ) {
      return 'suppress';
    }
  }
  return 'fail';
}

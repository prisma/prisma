/**
 * SQL relational schema-diff exports.
 *
 * The generic node differ (`buildPostgresPlanDiff` / `buildSqlitePlanDiff`)
 * drives both plan and verify over the trees as derived — no pre-diff
 * transformation. This module surfaces the verify-verdict machinery. Pure —
 * no database connection required.
 */

export type {
  SqlDiffVerdict,
  SqlDiffVerdictInput,
  StorageTypeVerdict,
  StorageTypeVerdictInput,
  VerifySqlSchemaByDiffInput,
} from '../core/diff/schema-verify';
export {
  classifyDiffSubjectGranularity,
  classifySqlDiffIssue,
  computeSqlDiffVerdict,
  computeStorageTypeVerdict,
  verifySqlSchemaByDiff,
} from '../core/diff/schema-verify';
export type { NativeTypeNormalizer } from '../core/diff/sql-schema-diff';
export { arraysEqual } from '../core/diff/sql-schema-diff';

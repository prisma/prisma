import type { SchemaDiffIssue } from './schema-diff';

export const VERIFY_CODE_MARKER_MISSING = 'CONTRACT.MARKER_MISSING';
export const VERIFY_CODE_HASH_MISMATCH = 'CONTRACT.MARKER_MISMATCH';
export const VERIFY_CODE_TARGET_MISMATCH = 'CONTRACT.TARGET_MISMATCH';
export const VERIFY_CODE_SCHEMA_FAILURE = 'CONTRACT.SCHEMA_VERIFICATION_FAILED';

export interface OperationContext {
  readonly contractPath?: string;
  readonly configPath?: string;
  readonly meta?: Readonly<Record<string, unknown>>;
}

export interface VerifyDatabaseResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly summary: string;
  readonly contract: {
    readonly storageHash: string;
    readonly profileHash?: string;
  };
  readonly marker?: {
    readonly storageHash?: string;
    readonly profileHash?: string;
  };
  readonly target: {
    readonly expected: string;
    readonly actual?: string;
  };
  readonly missingCodecs?: readonly string[];
  readonly codecCoverageSkipped?: boolean;
  readonly meta?: {
    readonly configPath?: string;
    readonly contractPath: string;
  };
  readonly timings: {
    readonly total: number;
  };
}

/**
 * The issue-based schema-verify result. `ok` derives from the FAILURE list
 * only: a verify passes exactly when `schema.issues` is empty, post
 * strict-gating and control-policy disposition.
 *
 * `schema.warnings` carries warn-graded issues (an `observed`-policy
 * subject's drift, and any other `warn` disposition) in the same shape.
 * Warnings are informational — they never affect `ok` — but they MUST be
 * surfaced: an `observed` table that drifted yields `ok: true` with a
 * non-empty warnings channel, which is what distinguishes "watch without
 * failing" from full suppression.
 */
export interface VerifyDatabaseSchemaResult {
  readonly ok: boolean;
  readonly code?: string;
  readonly summary: string;
  readonly contract: {
    readonly storageHash: string;
    readonly profileHash?: string;
  };
  readonly target: {
    readonly expected: string;
    readonly actual?: string;
  };
  readonly schema: {
    readonly issues: readonly SchemaDiffIssue[];
    readonly warnings?: {
      readonly issues: readonly SchemaDiffIssue[];
    };
  };
  readonly meta?: {
    readonly configPath?: string;
    readonly contractPath?: string;
    readonly strict: boolean;
  };
  readonly timings: {
    readonly total: number;
  };
}

export interface EmitContractResult {
  readonly contractJson: string;
  readonly contractDts: string;
  readonly storageHash: string;
  readonly executionHash?: string;
  readonly profileHash: string;
}

export interface IntrospectSchemaResult<TSchemaIR> {
  readonly ok: true;
  readonly summary: string;
  readonly target: {
    readonly familyId: string;
    readonly id: string;
  };
  readonly schema: TSchemaIR;
  readonly meta?: {
    readonly configPath?: string;
    readonly dbUrl?: string;
  };
  readonly timings: {
    readonly total: number;
  };
}

export interface SignDatabaseResult {
  readonly ok: boolean;
  readonly summary: string;
  readonly contract: {
    readonly storageHash: string;
    readonly profileHash?: string;
  };
  readonly target: {
    readonly expected: string;
    readonly actual?: string;
  };
  readonly marker: {
    readonly created: boolean;
    readonly updated: boolean;
    readonly previous?: {
      readonly storageHash?: string;
      readonly profileHash?: string;
    };
  };
  readonly meta?: {
    readonly configPath?: string;
    readonly contractPath: string;
  };
  readonly timings: {
    readonly total: number;
  };
}

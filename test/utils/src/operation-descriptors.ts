/**
 * Adapter-agnostic operation type descriptors for test fixtures.
 *
 * These descriptors match common PostgreSQL vector operations but don't depend on
 * @internal/adapter-postgres or any target-specific packages.
 * Use these in test fixtures to avoid adapter/target dependencies.
 *
 * The shape matches `OperationTypes` from `@internal/sql-relational-core/types`
 * but is defined locally to keep test-utils dependency-free.
 */

/**
 * Operation type signature for type-level tests.
 */
export type OperationTypeSignature = {
  readonly args: ReadonlyArray<{ readonly codecId: string; readonly nullable: boolean }>;
  readonly returns: { readonly codecId: string; readonly nullable: boolean };
  readonly lowering: {
    readonly targetFamily: string;
    readonly strategy: string;
    readonly template: string;
  };
};

/**
 * Test operations type for pg/vector@1.
 * Includes common vector operations: cosineDistance, l2Distance.
 */
export type PgVectorOperations = {
  readonly 'pg/vector@1': {
    readonly cosineDistance: {
      readonly args: ReadonlyArray<{ readonly codecId: 'pg/vector@1'; readonly nullable: false }>;
      readonly returns: { readonly codecId: 'core/float8'; readonly nullable: false };
      readonly lowering: {
        readonly targetFamily: 'sql';
        readonly strategy: 'function';
        readonly template: string;
      };
    };
    readonly cosineSimilarity: {
      readonly args: ReadonlyArray<{ readonly codecId: 'pg/vector@1'; readonly nullable: false }>;
      readonly returns: { readonly codecId: 'core/float8'; readonly nullable: false };
      readonly lowering: {
        readonly targetFamily: 'sql';
        readonly strategy: 'function';
        readonly template: string;
      };
    };
    readonly l2Distance: {
      readonly args: ReadonlyArray<{ readonly codecId: 'pg/vector@1'; readonly nullable: false }>;
      readonly returns: { readonly codecId: 'core/float8'; readonly nullable: false };
      readonly lowering: {
        readonly targetFamily: 'sql';
        readonly strategy: 'function';
        readonly template: string;
      };
    };
  };
};

/**
 * Test operations type for pg/text@1.
 * Includes common text operations: length.
 */
export type PgTextOperations = {
  readonly 'pg/text@1': {
    readonly length: {
      readonly args: ReadonlyArray<never>;
      readonly returns: { readonly codecId: 'core/float8'; readonly nullable: false };
      readonly lowering: {
        readonly targetFamily: 'sql';
        readonly strategy: 'function';
        readonly template: string;
      };
    };
  };
};

/**
 * Combined test operations type with both vector and text operations.
 * Useful for testing operation type extraction and filtering.
 */
export type CombinedTestOperations = PgVectorOperations & PgTextOperations;

import { type } from 'arktype';

export const MigrationOpSchema = type({
  id: 'string',
  label: 'string',
  operationClass: "'additive' | 'widening' | 'destructive' | 'data'",
  'invariantId?': 'string',
});

// Intentionally shallow: operation-specific payload validation is owned by planner/runner layers.
export const MigrationOpsSchema = MigrationOpSchema.array();

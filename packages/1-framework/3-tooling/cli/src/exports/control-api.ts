/**
 * Programmatic Control API for Prisma Next.
 *
 * This module exports the control client factory and types for programmatic
 * access to control-plane operations without using the CLI.
 *
 * @see README.md "Programmatic Control API" section for usage examples
 * @module
 */

// Re-export core control plane types for consumer convenience
export type {
  ControlStack,
  SignDatabaseResult,
  VerifyDatabaseResult,
  VerifyDatabaseSchemaResult,
} from '@internal/framework-components/control';
// Client factory
export { createControlClient } from '../control-api/client';

// Contract enrichment (merges framework-derived capabilities and extension pack metadata)
export { enrichContract } from '../control-api/contract-enrichment';
export { executeContractEmit } from '../control-api/operations/contract-emit';
// Standalone operations (for tooling that doesn't need full client).
// These drive the aggregate-pipeline `db init` / `db update` / `db verify`
// flow against a loaded contract-space aggregate.
export { type ExecuteDbInitOptions, executeDbInit } from '../control-api/operations/db-init';
export {
  type ExecuteDbUpdateOptions,
  executeDbUpdate,
} from '../control-api/operations/db-update';
export {
  type ExecuteDbVerifyOptions,
  type ExecuteDbVerifyResult,
  executeDbVerify,
} from '../control-api/operations/db-verify';
// CLI-specific types
export type {
  ContractEmitOptions,
  ContractEmitResult,
  ControlActionName,
  ControlClient,
  ControlClientOptions,
  ControlProgressEvent,
  DbInitFailure,
  DbInitFailureCode,
  DbInitOptions,
  DbInitResult,
  DbInitSuccess,
  DbUpdateFailure,
  DbUpdateFailureCode,
  DbUpdateOptions,
  DbUpdateResult,
  DbUpdateSuccess,
  EmitContractConfig,
  EmitFailure,
  EmitFailureCode,
  EmitOptions,
  EmitResult,
  EmitSuccess,
  IntrospectOptions,
  OnControlProgress,
  SchemaVerifyOptions,
  SignOptions,
  VerifyOptions,
} from '../control-api/types';
// Lifecycle helpers for hosts that publish to many output paths
export { disposeEmitQueue } from '../utils/emit-queue';

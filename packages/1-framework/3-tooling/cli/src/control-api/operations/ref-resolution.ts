/**
 * Client-free contract/migration reference resolution for commands, wrapping migration-tools' parsers with the CLI error mapping.
 */

import type { MigrationGraph } from '@internal/migration-tools/graph';
import type { ContractRef, MigrationRef } from '@internal/migration-tools/ref-resolution';
import { parseContractRef, parseMigrationRef } from '@internal/migration-tools/ref-resolution';
import type { Refs } from '@internal/migration-tools/refs';
import { notOk, ok, type Result } from '@internal/utils/result';
import { type CliStructuredError, mapRefResolutionError } from '../../utils/cli-errors';

export interface RefResolutionContext {
  readonly graph: MigrationGraph;
  readonly refs: Refs;
  readonly contractHash?: string;
}

export function resolveContractRef(
  input: string,
  context: RefResolutionContext,
): Result<ContractRef, CliStructuredError> {
  const result = parseContractRef(input, context);
  return result.ok ? ok(result.value) : notOk(mapRefResolutionError(result.failure));
}

export function resolveMigrationRef(
  input: string,
  context: { readonly graph: MigrationGraph; readonly refs: Refs },
): Result<MigrationRef, CliStructuredError> {
  const result = parseMigrationRef(input, context);
  return result.ok ? ok(result.value) : notOk(mapRefResolutionError(result.failure));
}

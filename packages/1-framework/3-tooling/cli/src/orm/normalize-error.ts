import { ifDefined } from '@internal/utils/defined';
import type { Diagnostic, NextAction } from '@prisma/cli-engine/protocol';
import { CliStructuredError } from '@prisma/cli-engine/protocol';

/**
 * The shape prisma/prisma's own `CliStructuredError` presents to this module.
 * Reading it structurally keeps the conversion working across module
 * boundaries, where `instanceof` does not.
 */
interface RaisedError {
  readonly code: `${string}.${string}`;
  readonly message: string;
  readonly severity?: Diagnostic['severity'];
  readonly why?: string;
  readonly fix?: string;
  readonly where?: { readonly path?: string; readonly line?: number };
  readonly meta?: Record<string, unknown>;
  readonly docsUrl?: string;
  readonly nextActions?: unknown;
}

function isRaisedError(error: unknown): error is Error & RaisedError {
  if (!(error instanceof Error)) {
    return false;
  }
  return (
    typeof Reflect.get(error, 'code') === 'string' &&
    typeof Reflect.get(error, 'toEnvelope') === 'function'
  );
}

/**
 * Both classes name themselves `CliStructuredError`, so the engine's duck test
 * accepts prisma/prisma's too. What actually separates them is `nextActions`:
 * the engine's constructor always sets it, prisma/prisma's never does.
 */
function conformsToProtocol(error: unknown): error is CliStructuredError {
  return CliStructuredError.is(error) && Array.isArray(error.nextActions);
}

/**
 * Turns the transitional `fix` prose into typed actions. A multi-line fix is
 * several pieces of advice, so it becomes one action per line.
 */
function actionsFromFix(fix: string | undefined): readonly NextAction[] {
  if (fix === undefined) {
    return [];
  }
  return fix
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .map((label) => ({ kind: 'user-choice', label }) satisfies NextAction);
}

/**
 * Projects a prisma/prisma-raised error onto the engine's diagnostic shape.
 */
export function toEngineDiagnostic(error: Error & RaisedError): Diagnostic {
  return {
    code: error.code,
    severity: error.severity ?? 'error',
    summary: error.message,
    ...ifDefined('why', error.why),
    nextActions: actionsFromFix(error.fix),
    ...ifDefined('where', error.where),
    ...ifDefined('meta', error.meta),
    ...ifDefined('docsUrl', error.docsUrl),
  };
}

/**
 * The handler boundary's single conversion. Handlers pass every error they
 * return through `notOk` — and every error a top-of-handler catch sees —
 * through this, so a settled envelope always carries `nextActions` and never
 * the non-protocol `fix` field.
 */
export function normalizeError(error: unknown): CliStructuredError {
  if (conformsToProtocol(error)) {
    return error;
  }
  if (!isRaisedError(error)) {
    const summary = error instanceof Error ? error.message : String(error);
    return new CliStructuredError('CLI.UNEXPECTED', summary, { cause: error });
  }

  const diagnostic = toEngineDiagnostic(error);
  return new CliStructuredError(diagnostic.code, diagnostic.summary, {
    severity: diagnostic.severity,
    nextActions: diagnostic.nextActions,
    ...ifDefined('why', diagnostic.why),
    ...ifDefined('where', diagnostic.where),
    ...ifDefined('meta', diagnostic.meta),
    ...ifDefined('docsUrl', diagnostic.docsUrl),
    cause: error,
  });
}

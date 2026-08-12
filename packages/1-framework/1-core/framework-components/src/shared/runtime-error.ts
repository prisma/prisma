export interface RuntimeErrorEnvelope extends Error {
  readonly code: string;
  readonly category:
    | 'PLAN'
    | 'CONTRACT'
    | 'LINT'
    | 'BUDGET'
    | 'RUNTIME'
    | 'DRIVER'
    | 'MIGRATION'
    | 'ORM';
  readonly severity: 'error';
  readonly details?: Record<string, unknown>;
}

/**
 * Type guard for the runtime-error envelope produced by `runtimeError`.
 *
 * Prefer this over duck-typing on `error.code` directly so consumers stay
 * insulated from the envelope's internal shape.
 */
export function isRuntimeError(error: unknown): error is RuntimeErrorEnvelope {
  return (
    error instanceof Error &&
    'code' in error &&
    typeof (error as { code?: unknown }).code === 'string' &&
    'category' in error &&
    'severity' in error
  );
}

export function runtimeError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): RuntimeErrorEnvelope {
  const error = Object.assign(new Error(message), {
    code,
    category: resolveCategory(code),
    severity: 'error' as const,
    ...(details !== undefined ? { details } : {}),
  });
  Object.defineProperty(error, 'name', { value: 'RuntimeError', configurable: true });
  return error;
}

function resolveCategory(code: string): RuntimeErrorEnvelope['category'] {
  const prefix = code.split('.')[0] ?? 'RUNTIME';
  switch (prefix) {
    case 'PLAN':
    case 'CONTRACT':
    case 'LINT':
    case 'BUDGET':
    case 'DRIVER':
    case 'MIGRATION':
    case 'ORM':
      return prefix;
    default:
      return 'RUNTIME';
  }
}

import { ifDefined } from './defined';

export interface StructuredError extends Error {
  readonly code: `${string}.${string}`;
  readonly why?: string;
  readonly fix?: string;
  readonly where?: { readonly path?: string; readonly line?: number };
  readonly severity?: 'error' | 'warn' | 'info';
  readonly meta?: Record<string, unknown>;
  readonly docsUrl?: string;
}

export interface StructuredErrorOptions {
  readonly why?: string;
  readonly fix?: string;
  readonly where?: { readonly path?: string; readonly line?: number };
  readonly severity?: 'error' | 'warn' | 'info';
  readonly meta?: Record<string, unknown>;
  readonly docsUrl?: string;
  readonly cause?: unknown;
}

const STRUCTURED_CODE_RE = /^[A-Z][A-Z0-9]*\.[A-Z][A-Z0-9_]*$/;

/** Whether a bare string is a published `NAMESPACE.SUBCODE` code. */
export function isStructuredErrorCode(code: string): code is StructuredError['code'] {
  return STRUCTURED_CODE_RE.test(code);
}

export function isStructuredError(e: unknown): e is StructuredError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    typeof e.code === 'string' &&
    isStructuredErrorCode(e.code) &&
    'message' in e &&
    typeof e.message === 'string'
  );
}

export function structuredError(
  code: StructuredError['code'],
  message: string,
  options?: StructuredErrorOptions,
): StructuredError {
  const error =
    options?.cause !== undefined
      ? new Error(message, { cause: options.cause })
      : new Error(message);
  Object.defineProperty(error, 'name', { value: 'StructuredError', configurable: true });
  return Object.assign(error, {
    code,
    ...ifDefined('why', options?.why),
    ...ifDefined('fix', options?.fix),
    ...ifDefined('where', options?.where),
    ...ifDefined('severity', options?.severity),
    ...ifDefined('meta', options?.meta),
    ...ifDefined('docsUrl', options?.docsUrl),
  });
}

export const DOCS_ERRORS_VERSION = 'next';
export const DOCS_BASE = `https://docs.prisma.io/docs/orm/${DOCS_ERRORS_VERSION}/reference/error-reference`;

export function docsUrlFor(code: string): string {
  return `${DOCS_BASE}#${code}`;
}

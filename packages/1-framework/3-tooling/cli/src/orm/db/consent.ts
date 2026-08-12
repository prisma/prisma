import { CliStructuredError } from '@prisma/cli-engine/protocol';

/** One planned operation whose class is destructive, as the control API reports it. */
export interface DestructiveOperation {
  readonly id: string;
  readonly label: string;
}

function isDestructiveOperation(value: unknown): value is DestructiveOperation {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  return (
    typeof Reflect.get(value, 'id') === 'string' && typeof Reflect.get(value, 'label') === 'string'
  );
}

/**
 * The operations a `DESTRUCTIVE_CHANGES` refusal carries. The failure's `meta`
 * is an open record, so the entries are read defensively rather than trusted.
 */
export function destructiveOperationsIn(
  meta: Record<string, unknown> | undefined,
): readonly DestructiveOperation[] {
  const listed = meta?.['destructiveOperations'];
  return Array.isArray(listed) ? listed.filter(isDestructiveOperation) : [];
}

/**
 * A path segment as the user would type it: `my%20db` is `my db`. A segment
 * whose escape sequences are malformed is kept as it was written, because
 * there is nothing better to show.
 */
function decodeSegment(segment: string): string {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function connectionUrl(connection: string): URL | undefined {
  try {
    return new URL(connection);
  } catch {
    return undefined;
  }
}

/**
 * The name a connection URL carries. A URL with a host addresses a server, and
 * `postgres://`, `mysql://` and `mongodb://` all put the database in the first
 * path segment — `postgres://host/appdb/extra` is `appdb`, not `extra`. A URL
 * with no host is a file path, whose name is its last segment.
 */
function urlDatabaseName(parsed: URL): string | undefined {
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  const named = parsed.host.length > 0 ? segments[0] : segments.at(-1);
  return named === undefined ? undefined : decodeSegment(named);
}

/** The database a driver-specific connection object names. */
function objectDatabaseName(connection: unknown): string | undefined {
  if (typeof connection !== 'object' || connection === null) {
    return undefined;
  }
  const database = Reflect.get(connection, 'database');
  return typeof database === 'string' && database.length > 0 ? database : undefined;
}

/**
 * What the user types to accept data loss. The most specific name the
 * invocation has for where it is writing, in order: the database a driver
 * connection object names, the database a connection URL names, the server that
 * URL points at, and — for a connection none of those rules recognise, such as
 * a libpq `host=… dbname=…` string or a bare file path — the target id.
 */
export function destructiveConsentToken(connection: unknown, targetId: string): string {
  const named = objectDatabaseName(connection);
  if (named !== undefined) {
    return named;
  }
  const parsed = typeof connection === 'string' ? connectionUrl(connection) : undefined;
  if (parsed !== undefined) {
    const database = urlDatabaseName(parsed);
    if (database !== undefined) {
      return database;
    }
    if (parsed.host.length > 0) {
      return parsed.host;
    }
  }
  return targetId;
}

/**
 * A token nobody can type is not consent: an empty one makes the engine's
 * type-to-confirm accept a bare Enter, and `--confirm ""` grant outright.
 */
export function errorConsentTokenUnresolved(targetId: string): CliStructuredError {
  return new CliStructuredError(
    'CLI.CONSENT_TOKEN_UNRESOLVED',
    'The database this run would change has no name to confirm.',
    {
      why: `Neither the resolved connection nor the target id "${targetId}" yields a name the consent prompt could ask you to type, so the destructive operations cannot be authorised.`,
      nextActions: [
        {
          kind: 'user-choice',
          label:
            'Name the database in `db.connection` (or pass `--db <url>`) and run `prisma-next db update` again.',
        },
      ],
    },
  );
}

/** A prompt that names nothing cannot be consented to knowingly. */
export function errorConsentOperationsMissing(): CliStructuredError {
  return new CliStructuredError(
    'CLI.CONSENT_OPERATIONS_MISSING',
    'The plan was refused as destructive but named no operations to confirm.',
    {
      why: 'The consent prompt has to list what is about to be destroyed, and the refusal carried no operations to list.',
      nextActions: [
        {
          kind: 'run-command',
          label: 'Preview the plan',
          command: 'prisma-next db update --dry-run',
        },
      ],
    },
  );
}

/** The question the user answers before anything is dropped. */
export function destructiveConsentQuestion(
  operations: readonly DestructiveOperation[],
  token: string,
): string {
  const listed = operations.map((operation) => `  - ${operation.label}`).join('\n');
  return [
    `Apply ${operations.length} destructive operation(s) to ${token}? Data they remove cannot be recovered:`,
    listed,
  ].join('\n');
}

/**
 * Destructive operations in an applied plan that the consented plan did not
 * name. The plan is recomputed on the call that carries the consent, so the two
 * can differ; nothing binds them, and this is how the operator finds out.
 */
export function unconsentedDestructiveOperations(
  consented: readonly DestructiveOperation[],
  applied: ReadonlyArray<DestructiveOperation & { readonly operationClass: string }>,
): readonly string[] {
  const granted = new Set(consented.map((operation) => operation.id));
  return applied
    .filter((operation) => operation.operationClass === 'destructive' && !granted.has(operation.id))
    .map((operation) => operation.label);
}

/** What the operator is told when the applied plan outgrew the consented one. */
export function unconsentedDestructiveWarning(labels: readonly string[]): string {
  return (
    `Applied ${labels.length} destructive operation(s) your consent did not cover: ${labels.join(', ')}. ` +
    'The plan is recomputed after consent, so it can differ from the one you approved.'
  );
}

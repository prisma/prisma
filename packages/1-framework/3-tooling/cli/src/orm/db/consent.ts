/** One planned operation whose class is destructive, as the control API reports it. */
interface DestructiveOperation {
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
 * The last non-empty path segment of a connection URL: `appdb` for
 * `postgres://user:secret@localhost:5432/appdb`. Undefined for a connection
 * that is not a URL, or one that names no database.
 */
function databaseNameIn(connection: string): string | undefined {
  let parsed: URL;
  try {
    parsed = new URL(connection);
  } catch {
    return undefined;
  }
  const segments = parsed.pathname.split('/').filter((segment) => segment.length > 0);
  return segments.at(-1);
}

/**
 * What the user types to accept data loss: the database the run is about to
 * change. A connection that names no database — or that is not a URL at all,
 * which a driver-specific connection object is — leaves the target id, which is
 * the only other name the invocation has for where it is writing.
 */
export function destructiveConsentToken(connection: unknown, targetId: string): string {
  const named = typeof connection === 'string' ? databaseNameIn(connection) : undefined;
  return named ?? targetId;
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

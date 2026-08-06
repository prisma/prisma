/**
 * Projects an error into a plain object carrying `name`, `message`, every own
 * enumerable property, and a recursively projected `cause`, so a `toEqual`
 * against the projection pins the whole structured-error shape — an added,
 * removed, or renamed field fails the assertion.
 */
export function errorShape(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) throw new Error(`expected an Error, got ${String(error)}`);
  const own = Object.fromEntries(Object.entries(error).filter(([key]) => key !== 'cause'));
  return {
    name: error.name,
    message: error.message,
    ...own,
    ...(error.cause === undefined ? {} : { cause: errorShape(error.cause) }),
  };
}

/** Resolves to the {@link errorShape} of the awaitable's rejection; fails if it fulfils. */
export async function rejectionShape(
  promise: PromiseLike<unknown>,
): Promise<Record<string, unknown>> {
  try {
    await promise;
  } catch (error) {
    return errorShape(error);
  }
  throw new Error('expected the promise to reject');
}

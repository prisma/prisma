/**
 * Allows aborting an async operation by returning a Promise which rejects if
 * the provided AbortSignal aborts and otherwise resolves with the result of
 * the async operation.
 *
 * Throws immediately if the signal is already aborted.
 * When the signal is aborted later, any wrapped promise will reject with
 * the signal's reason (or a default DOMException).
 *
 * @example
 * ```typescript
 * const { signal = new AbortController().signal } = options;
 * const unlessAborted = abortable(signal);
 *
 * // Any of these will reject if signal is aborted
 * await unlessAborted(asyncOperation());
 * await unlessAborted(fetch(url));
 * ```
 *
 * @param signal - The AbortSignal to race against
 * @returns A function that wraps promises to be cancelable
 * @throws If signal is already aborted
 */
export function abortable(signal: AbortSignal): <T>(promise: Promise<T>) => Promise<T> {
  signal.throwIfAborted();

  const abortPromise = new Promise<never>((_resolve, reject) => {
    signal.addEventListener(
      'abort',
      () => {
        reject(signal.reason ?? new DOMException('Operation cancelled'));
      },
      { once: true },
    );
  });

  return <T>(operation: Promise<T>): Promise<T> => {
    return Promise.race([operation, abortPromise]);
  };
}

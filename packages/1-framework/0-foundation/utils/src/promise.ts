/**
 * Returns true when `value` has a `.then` method, narrowing its type to
 * `PromiseLike<T>`. Safer than `instanceof Promise` because it works across
 * realm boundaries and with any thenable (e.g. custom promise implementations).
 */
export function isThenable<T>(value: T | PromiseLike<T>): value is PromiseLike<T> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'then' in value &&
    typeof value.then === 'function'
  );
}

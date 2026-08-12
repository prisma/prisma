// Fixture (b): `TypeError` / `RangeError` / `InternalError` throws — no-bare-throw must NOT fire.
// The plugin only flags a `JsNewExpression` callee whose text is exactly `Error`.

declare class InternalError extends Error {}

export function requireString(value: unknown): string {
  if (typeof value !== 'string') {
    throw new TypeError('expected a string');
  }
  return value;
}

export function requireInRange(value: number, max: number): number {
  if (value > max) {
    throw new RangeError('value out of range');
  }
  return value;
}

export function unreachable(): never {
  throw new InternalError('unreachable branch reached');
}

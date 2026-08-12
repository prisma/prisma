/**
 * Strict plain-object guard: accepts only objects with `Object.prototype`
 * or `null` as their prototype. Rejects arrays, class instances, and other
 * non-plain objects. Used to distinguish raw-data records from IR class
 * instances in validation and hydration paths.
 */
export function isPlainRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false;
  const proto: unknown = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

import { blindCast } from './casts';

/**
 * Returns an object with the key/value if value is defined, otherwise an empty object.
 *
 * Use with spread to conditionally include optional properties while satisfying
 * exactOptionalPropertyTypes. This is explicit about which properties are optional
 * and won't inadvertently strip other undefined values.
 *
 * @example
 * ```typescript
 * // Instead of:
 * const obj = {
 *   required: 'value',
 *   ...(optional ? { optional } : {}),
 * };
 *
 * // Use:
 * const obj = {
 *   required: 'value',
 *   ...ifDefined('optional', optional),
 * };
 * ```
 */
export function ifDefined<K extends string, V>(
  key: K,
  value: V | undefined,
): Record<never, never> | { [P in K]: V } {
  return value !== undefined
    ? blindCast<{ [P in K]: V }, 'computed key K; value is defined'>({ [key]: value })
    : {};
}

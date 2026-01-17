/**
 * Value classification for parameterization.
 *
 * This module classifies runtime values into categories before applying
 * schema rules during parameterization.
 */

/**
 * Tagged value types that represent scalar values.
 * These can be parameterized when the schema allows.
 */
const SCALAR_TAGS = new Set(['DateTime', 'Decimal', 'BigInt', 'Bytes', 'Json'])

/**
 * Tagged value types that are structural and should never be parameterized.
 * These represent special query constructs that must be preserved as-is.
 */
const STRUCTURAL_TAGS = new Set(['FieldRef', 'Enum', 'Param', 'Raw'])

/**
 * Classification result for a runtime value.
 * Used to determine how to handle the value during parameterization.
 */
export type ValueClass =
  | { kind: 'null' }
  | { kind: 'primitive'; value: string | number | boolean }
  | { kind: 'taggedScalar'; tag: string; value: unknown }
  | { kind: 'structural'; tag: string; value: unknown }
  | { kind: 'array'; items: unknown[] }
  | { kind: 'object'; entries: Record<string, unknown> }

/**
 * Classifies a runtime value for parameterization purposes.
 *
 * @param value - The value to classify
 * @returns The classification result indicating how to handle the value
 */
export function classifyValue(value: unknown): ValueClass {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return { kind: 'null' }
  }

  // Handle primitives
  if (typeof value === 'string') {
    return { kind: 'primitive', value }
  }
  if (typeof value === 'number') {
    return { kind: 'primitive', value }
  }
  if (typeof value === 'boolean') {
    return { kind: 'primitive', value }
  }

  // Handle arrays
  if (Array.isArray(value)) {
    return { kind: 'array', items: value }
  }

  // Handle objects
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>

    // Check for tagged value
    if ('$type' in obj && typeof obj.$type === 'string') {
      const tag = obj.$type

      // Check if it's a scalar tag
      if (SCALAR_TAGS.has(tag)) {
        return { kind: 'taggedScalar', tag, value: obj.value }
      }

      // Check if it's a structural tag
      if (STRUCTURAL_TAGS.has(tag)) {
        return { kind: 'structural', tag, value: obj.value }
      }

      // Unknown tag - treat as structural to be safe
      return { kind: 'structural', tag, value: obj.value }
    }

    // Plain object
    return { kind: 'object', entries: obj }
  }

  // Unknown type - treat as structural (don't parameterize)
  return { kind: 'structural', tag: 'unknown', value }
}

/**
 * Checks if a value is a plain object (not a tagged value or array).
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    !('$type' in (value as Record<string, unknown>))
  )
}

/**
 * Checks if a value is a tagged value with a $type property.
 */
export function isTaggedValue(value: unknown): value is { $type: string; value: unknown } {
  return (
    typeof value === 'object' &&
    value !== null &&
    '$type' in value &&
    typeof (value as { $type: unknown }).$type === 'string'
  )
}

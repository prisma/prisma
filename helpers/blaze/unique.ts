import type { L } from 'ts-toolbelt'

/**
 * Narrow a list to only have unique values.
 * @param list
 * @returns
 */
function unique<I>(list: L.List<I>) {
  return Array.from(new Set(list))
}

export { unique }

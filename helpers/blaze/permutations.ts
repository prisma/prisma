import type { L } from 'ts-toolbelt'

/**
 * Returns an iterator over all permutation of a `list`.
 *
 * @param list - original list to permute (possibly read only).
 *
 * @returns an iterator that lazily computes the possible permutations. The new
 * lists have their type relaxed from `L.List<T>` to just `T[]` to make them
 * easier to use and make it possible to pass them directly to functions that
 * expect regular array types.
 */
export function* permutations<T>(list: L.List<T>): Generator<T[]> {
  if (list.length <= 1) {
    // Return a copy because the contract of the function states it safe to
    // mutate the result but the parameter is read only.
    yield [...list]
    return
  }

  for (const permutation of permutations(list.slice(1))) {
    for (let i = 0; i < list.length; i++) {
      yield [...permutation.slice(0, i), list[0], ...permutation.slice(i)]
    }
  }
}

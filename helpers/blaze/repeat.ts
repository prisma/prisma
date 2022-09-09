/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { F, L } from 'ts-toolbelt'

/**
 * An accumulable function can be passed its output as input
 */
export type Accumulable<P, R> = (arg0: R, ...rest: P[]) => R

/**
 * Repeat an {@link Accumulable} function.
 *
 * @param f to be repeated until...
 * @param again return false to exit
 * @returns
 * @example
 * ```ts
 * // concats `[2]` 10 times on `[1]`
 * repeat(concat, times(10))([1], [2])
 * ```
 */
function repeat<P extends L.Update<P, 0, R>, R>(f: (...p: P) => R, again: (...p: F.NoInfer<P>) => boolean) {
  return (...p: P) => {
    // ts does not understand
    const pClone: any = [...p]

    while (again(...pClone)) {
      pClone[0] = f(...pClone)
    }

    return pClone[0] as R
  }
}

function times(n: number) {
  return () => --n > -1
}

export { repeat, times }

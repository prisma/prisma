/* eslint-disable @typescript-eslint/no-unsafe-argument */

import type { A, F } from 'ts-toolbelt'

import { skip } from './transduce'

function pipeSync(fn: F.Function, ...fns: F.Function[]) {
  return (...args: unknown[]) => {
    let result = fn(...args)

    for (let i = 0; result !== skip && i < fns.length; ++i) {
      result = fns[i](result)
    }

    return result
  }
}

function pipeAsync(fn: F.Function, ...fns: F.Function[]) {
  return async (...args: unknown[]) => {
    let result = await fn(...args)

    for (let i = 0; result !== skip && i < fns.length; ++i) {
      result = await fns[i](result)
    }

    return result
  }
}

/**
 * Pipe the input and output of functions.
 *
 * @param fn parameter-taking function
 * @param fns subsequent piped functions
 * @returns
 */
const pipe = pipeSync as PipeMultiSync & {
  async: PipeMultiAsync
}

pipe.async = pipeAsync

// TODO: use the one from ts-toolbelt (broken atm since ts 4.1)
export declare type PipeMultiSync = {
  <R0, P extends any[]>(...fns: [F.Function<P, R0>]): F.Function<P, R0>
  <R0, R1, P extends any[]>(...fns: [F.Function<P, R0>, F.Function<[R0], R1>]): F.Function<P, R1>
  <R0, R1, R2, P extends any[]>(...fns: [F.Function<P, R0>, F.Function<[R0], R1>, F.Function<[R1], R2>]): F.Function<
    P,
    R2
  >
  <R0, R1, R2, R3, P extends any[]>(
    ...fns: [F.Function<P, R0>, F.Function<[R0], R1>, F.Function<[R1], R2>, F.Function<[R2], R3>]
  ): F.Function<P, R3>
  <R0, R1, R2, R3, R4, P extends any[]>(
    ...fns: [F.Function<P, R0>, F.Function<[R0], R1>, F.Function<[R1], R2>, F.Function<[R2], R3>, F.Function<[R3], R4>]
  ): F.Function<P, R4>
  <R0, R1, R2, R3, R4, R5, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[R0], R1>,
      F.Function<[R1], R2>,
      F.Function<[R2], R3>,
      F.Function<[R3], R4>,
      F.Function<[R4], R5>,
    ]
  ): F.Function<P, R5>
  <R0, R1, R2, R3, R4, R5, R6, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[R0], R1>,
      F.Function<[R1], R2>,
      F.Function<[R2], R3>,
      F.Function<[R3], R4>,
      F.Function<[R4], R5>,
      F.Function<[R5], R6>,
    ]
  ): F.Function<P, R6>
  <R0, R1, R2, R3, R4, R5, R6, R7, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[R0], R1>,
      F.Function<[R1], R2>,
      F.Function<[R2], R3>,
      F.Function<[R3], R4>,
      F.Function<[R4], R5>,
      F.Function<[R5], R6>,
      F.Function<[R6], R7>,
    ]
  ): F.Function<P, R7>
  <R0, R1, R2, R3, R4, R5, R6, R7, R8, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[R0], R1>,
      F.Function<[R1], R2>,
      F.Function<[R2], R3>,
      F.Function<[R3], R4>,
      F.Function<[R4], R5>,
      F.Function<[R5], R6>,
      F.Function<[R6], R7>,
      F.Function<[R7], R8>,
    ]
  ): F.Function<P, R8>
  <R0, R1, R2, R3, R4, R5, R6, R7, R8, R9, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[R0], R1>,
      F.Function<[R1], R2>,
      F.Function<[R2], R3>,
      F.Function<[R3], R4>,
      F.Function<[R4], R5>,
      F.Function<[R5], R6>,
      F.Function<[R6], R7>,
      F.Function<[R7], R8>,
      F.Function<[R8], R9>,
    ]
  ): F.Function<P, R9>
}

export declare type PipeMultiAsync = {
  // eslint-disable-next-line prettier/prettier
  <R0, P extends any[]>(...fns: [F.Function<P, R0>]): F.Function<P, Promise<A.Await<R0>>>
  <R0, R1, P extends any[]>(
    // eslint-disable-next-line prettier/prettier
    ...fns: [F.Function<P, R0>, F.Function<[A.Await<R0>], R1>]
  ): F.Function<P, Promise<A.Await<R1>>>
  <R0, R1, R2, P extends any[]>(
    ...fns: [F.Function<P, R0>, F.Function<[A.Await<R0>], R1>, F.Function<[A.Await<R1>], R2>]
  ): F.Function<P, Promise<A.Await<R2>>>
  <R0, R1, R2, R3, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[A.Await<R0>], R1>,
      F.Function<[A.Await<R1>], R2>,
      F.Function<[A.Await<R2>], R3>,
    ]
  ): F.Function<P, Promise<A.Await<R3>>>
  <R0, R1, R2, R3, R4, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[A.Await<R0>], R1>,
      F.Function<[A.Await<R1>], R2>,
      F.Function<[A.Await<R2>], R3>,
      F.Function<[A.Await<R3>], R4>,
    ]
  ): F.Function<P, Promise<A.Await<R4>>>
  <R0, R1, R2, R3, R4, R5, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[A.Await<R0>], R1>,
      F.Function<[A.Await<R1>], R2>,
      F.Function<[A.Await<R2>], R3>,
      F.Function<[A.Await<R3>], R4>,
      F.Function<[A.Await<R4>], R5>,
    ]
  ): F.Function<P, Promise<A.Await<R5>>>
  <R0, R1, R2, R3, R4, R5, R6, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[A.Await<R0>], R1>,
      F.Function<[A.Await<R1>], R2>,
      F.Function<[A.Await<R2>], R3>,
      F.Function<[A.Await<R3>], R4>,
      F.Function<[A.Await<R4>], R5>,
      F.Function<[A.Await<R5>], R6>,
    ]
  ): F.Function<P, Promise<A.Await<R6>>>
  <R0, R1, R2, R3, R4, R5, R6, R7, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[A.Await<R0>], R1>,
      F.Function<[A.Await<R1>], R2>,
      F.Function<[A.Await<R2>], R3>,
      F.Function<[A.Await<R3>], R4>,
      F.Function<[A.Await<R4>], R5>,
      F.Function<[A.Await<R5>], R6>,
      F.Function<[A.Await<R6>], R7>,
    ]
  ): F.Function<P, Promise<A.Await<R7>>>
  <R0, R1, R2, R3, R4, R5, R6, R7, R8, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[A.Await<R0>], R1>,
      F.Function<[A.Await<R1>], R2>,
      F.Function<[A.Await<R2>], R3>,
      F.Function<[A.Await<R3>], R4>,
      F.Function<[A.Await<R4>], R5>,
      F.Function<[A.Await<R5>], R6>,
      F.Function<[A.Await<R6>], R7>,
      F.Function<[A.Await<R7>], R8>,
    ]
  ): F.Function<P, Promise<A.Await<R8>>>
  <R0, R1, R2, R3, R4, R5, R6, R7, R8, R9, P extends any[]>(
    ...fns: [
      F.Function<P, R0>,
      F.Function<[A.Await<R0>], R1>,
      F.Function<[A.Await<R1>], R2>,
      F.Function<[A.Await<R2>], R3>,
      F.Function<[A.Await<R3>], R4>,
      F.Function<[A.Await<R4>], R5>,
      F.Function<[A.Await<R5>], R6>,
      F.Function<[A.Await<R6>], R7>,
      F.Function<[A.Await<R7>], R8>,
      F.Function<[A.Await<R8>], R9>,
    ]
  ): F.Function<P, Promise<A.Await<R9>>>
}

export { pipe }

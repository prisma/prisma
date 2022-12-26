/* eslint-disable prettier/prettier */

import runtime from '@prisma/client/runtime'

/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new Prisma()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://github.com/prisma/prisma/blob/main/docs/prisma-client-js/api.md).
 */
export declare const PrismaClient: any
/**
 * ##  Prisma Client ʲˢ
 *
 * Type-safe database client for TypeScript & Node.js
 * @example
 * ```
 * const prisma = new Prisma()
 * // Fetch zero or more Users
 * const users = await prisma.user.findMany()
 * ```
 *
 *
 * Read more in our [docs](https://github.com/prisma/prisma/blob/main/docs/prisma-client-js/api.md).
 */
export declare type PrismaClient = any

export declare type PrismaClientExtends<ExtArgs extends runtime.Types.Extensions.Args = unknown> = {
  $extends: { extArgs: ExtArgs } & (<
    R extends runtime.Types.Extensions.UserArgs['result'] = {},
    M extends runtime.Types.Extensions.UserArgs['model'] = {},
    Q extends runtime.Types.Extensions.UserArgs['query'] = {},
    C extends runtime.Types.Extensions.UserArgs['client'] = {},
    Args extends runtime.Types.Extensions.Args = {
      result: { [K in keyof R]: { [P in keyof R[K]]: () => R[K][P] } },
      model: { [K in keyof M]: { [P in keyof M[K]]: () => M[K][P] } },
      query: { [K in keyof Q]: { [P in keyof Q[K]]: () => Q[K][P] } },
      client: { [K in keyof C]: () => C[K] }
    }
  >(args: ((client: PrismaClientExtends<ExtArgs>) => { $extends: { extArgs: Args } }) | {
    result?: R; model?: M; query?: Q; client?: C
  }) => PrismaClientExtends<Args & ExtArgs>)
}

export declare const dmmf: any
export declare type dmmf = any

/**
 * Get the type of the value, that the Promise holds.
 */
export declare type PromiseType<T extends PromiseLike<any>> = T extends PromiseLike<infer U> ? U : T

/**
 * Get the return type of a function which returns a Promise.
 */
export declare type PromiseReturnType<T extends (...args: any) => Promise<any>> = PromiseType<ReturnType<T>>

export namespace Prisma {
  export type TransactionClient = any

  export function defineExtension<
    R extends runtime.Types.Extensions.UserArgs['result'] = {},
    M extends runtime.Types.Extensions.UserArgs['model'] = {},
    Q extends runtime.Types.Extensions.UserArgs['query'] = {},
    C extends runtime.Types.Extensions.UserArgs['client'] = {},
    Args extends runtime.Types.Extensions.Args = {
      result: { [K in keyof R]: { [P in keyof R[K]]: () => R[K][P] } },
      model: { [K in keyof M]: { [P in keyof M[K]]: () => M[K][P] } },
      query: { [K in keyof Q]: { [P in keyof Q[K]]: () => Q[K][P] } },
      client: { [K in keyof C]: () => C[K] }
    }
  >(args: ((client: PrismaClientExtends) => { $extends: { extArgs: Args } }) | {
    result?: R; model?: M; query?: Q; client?: C
  }): (client: any) => PrismaClientExtends<Args>
}

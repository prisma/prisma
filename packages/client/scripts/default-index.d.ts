import runtime from './runtime'
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
    R extends runtime.Types.Extensions.Args['result'] = {},
    M extends runtime.Types.Extensions.Args['model'] = {},
    Q extends runtime.Types.Extensions.Args['query'] = {},
    C extends runtime.Types.Extensions.Args['client'] = {},
    Ext extends (
      client: runtime.Types.Extensions.GenericPrismaClient<runtime.Types.Extensions.DefaultArgs>,
    ) => runtime.GenericPrismaClient<{ result: R; model: M; query: Q; client: C }>,
  >(extension: Ext): Ext
}

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
 * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client).
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
 * Read more in our [docs](https://www.prisma.io/docs/concepts/components/prisma-client).
 */
export declare type PrismaClient = any

export declare type PrismaClientExtends<
  ExtArgs extends runtime.Types.Extensions.Args = runtime.Types.Extensions.DefaultArgs,
> = {
  $extends: { extArgs: ExtArgs } & (<
    R extends runtime.Types.Extensions.UserArgs['result'] = {},
    M extends runtime.Types.Extensions.UserArgs['model'] = {},
    Q extends runtime.Types.Extensions.UserArgs['query'] = {},
    C extends runtime.Types.Extensions.UserArgs['client'] = {},
    Args extends runtime.Types.Extensions.Args = runtime.Types.Extensions.InternalArgs<R, M, Q, C>,
  >(
    args:
      | ((client: PrismaClientExtends<ExtArgs>) => { $extends: { extArgs: Args } })
      | { name?: string; result?: R; model?: M; query?: Q; client?: C },
  ) => PrismaClientExtends<Args & ExtArgs>)
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
    Args extends runtime.Types.Extensions.Args = runtime.Types.Extensions.InternalArgs<R, M, Q, C>,
  >(
    args:
      | ((client: PrismaClientExtends) => { $extends: { extArgs: Args } })
      | { name?: string; result?: R; model?: M; query?: Q; client?: C },
  ): (client: any) => PrismaClientExtends<Args>

  export type Extension = runtime.Types.Extensions.UserArgs
  export import getExtensionContext = runtime.Extensions.getExtensionContext
  export type Args<T, F extends runtime.Types.Public.Operation> = runtime.Types.Public.Args<T, F> & {}
  export type Payload<T, F extends runtime.Types.Public.Operation> = runtime.Types.Public.Payload<T, F> & {}
  export type Result<T, A, F extends runtime.Types.Public.Operation> = runtime.Types.Public.Result<T, A, F> & {}
  export type Exact<T, W> = runtime.Types.Public.Exact<T, W> & {}
}

import { ExtArgsSymbol } from '../extensions'
import { RequiredArgs as Args } from '../extensions/$extends'
import { PatchFlat3 } from './Utils'

export type DefaultArgs = { result: {}; model: {}; query: {}; client: {} }

export type GetResultPayload<Base extends object, R extends Args['result'][string]> =
  //
  PatchFlat3<{}, Base, { [K in keyof R]: ReturnType<R[K]['compute']> }>

export type GetResultSelect<Base extends object, R extends Args['result'][string]> =
  //
  Base & { [K in keyof R]?: true }

export type GetModel<Base extends object, M extends Args['model'][string]> =
  //
  PatchFlat3<{}, Base, M>

export type { Args }

export interface ExtArgsContainer<ExtArgs extends Args> {
  [ExtArgsSymbol]: ExtArgs
}

export interface GenericPrismaClient<ExtArgs extends Args> extends ExtArgsContainer<ExtArgs> {
  [ExtArgsSymbol]: ExtArgs

  $extends<
    R extends Args['result'] = {},
    M extends Args['model'] = {},
    Q extends Args['query'] = {},
    C extends Args['client'] = {},
  >(
    ext:
      | ((client: this) => GenericPrismaClient<{ result: R; model: M; query: Q; client: C }>)
      | { result: R; model: M; query: Q; client: C },
  ): ExtArgsContainer<{ result: R; model: M; query: Q; client: C }>
}

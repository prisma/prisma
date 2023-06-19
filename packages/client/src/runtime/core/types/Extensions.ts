import { Sql } from 'sql-template-tag'

import { ITXClientDenyList } from '../../itxClientDenyList'
import { RequiredArgs as UserArgs } from '../extensions/$extends'
import { GetFindResult, GetResult as GetOperationResult, Operation } from './GetResult'
import { PrismaPromise } from './Public'
import { Call, ComputeDeep, Fn, HasAllOptionalKeys, Optional, Path, Return, UnwrapTuple } from './Utils'

/* eslint-disable prettier/prettier */

export type InternalArgs<
  Q = { [K in string]: { [K in string]: unknown } },
  R = { [K in string]: { [K in string]: unknown } },
  M = { [K in string]: { [K in string]: unknown } },
  C = { [K in string]: unknown },
> = {
  result: { [K in keyof R]: { [P in keyof R[K]]: () => R[K][P] } },
  query: { [K in keyof Q]: { [P in keyof Q[K]]: () => Q[K][P] } },
  model: { [K in keyof M]: { [P in keyof M[K]]: () => M[K][P] } },
  client: { [K in keyof C]: () => C[K] },
}

export type Args = InternalArgs

export type DefaultArgs = InternalArgs<{}, {}, {}, {}>

export type GetResult<Base extends Record<any, any>, R extends Args['result'][string], _R extends Args['result'][string] = Record<string, any> extends R ? {} : R> =
  { [K in keyof _R | keyof Base]: K extends keyof _R ? Return<Path<Return<_R[K]>, ['compute']>> : Base[K] }

export type GetSelect<Base extends Record<any, any>, R extends Args['result'][string], _R extends Args['result'][string] = Record<string, any> extends R ? {} : R> =
  { [K in keyof _R | keyof Base]?: K extends keyof _R ? boolean : Base[K] }

/** Query */

export type DynamicQueryExtensionArgs<Q_, TypeMap extends Record<string, any>> = {
  [K in keyof Q_]:
    K extends '$allOperations'
    ? (args: { model?: string, operation: string, args: any, query: (args: any) => PrismaPromise<any> }) => Promise<any>
    : K extends '$allModels'
      ? {
          [P in keyof Q_[K] | keyof TypeMap['model'][keyof TypeMap['model']] | '$allOperations']?:
            P extends '$allOperations'
            ? DynamicQueryExtensionCb<TypeMap, [T: 'model', M: keyof TypeMap['model'], F: keyof TypeMap['model'][keyof TypeMap['model']]]>
            : P extends keyof TypeMap['model'][keyof TypeMap['model']]
              ? DynamicQueryExtensionCb<TypeMap, [T: 'model', M: keyof TypeMap['model'], F: P]>
              : never
        }
      : K extends TypeMap['meta']['modelProps']
        ? {
            [P in keyof Q_[K] | keyof TypeMap['model'][ModelKey<TypeMap, K>] | '$allOperations']?:
              P extends '$allOperations'
              ? DynamicQueryExtensionCb<TypeMap, [T: 'model', M: ModelKey<TypeMap, K>, F: keyof TypeMap['model'][ModelKey<TypeMap, K>]]>
              : P extends keyof TypeMap['model'][ModelKey<TypeMap, K>]
                ? DynamicQueryExtensionCb<TypeMap, [T: 'model', M: ModelKey<TypeMap, K>, F: P]>
                : never
          }
      : K extends keyof TypeMap['other']
        ? DynamicQueryExtensionCb<TypeMap, [T: 'other', F: K]>
        : never
}

type DynamicQueryExtensionCb<TypeMap extends Record<string, any>, TypeMapPath extends (keyof any)[]> =
  <A extends DynamicQueryExtensionCbArgs<TypeMap, TypeMapPath>>(args: A) =>
    Promise<DynamicQueryExtensionCbResult<TypeMap, TypeMapPath>>

type DynamicQueryExtensionCbArgs<TypeMap extends Record<string, any>, TypeMapPath extends (keyof any)[]> = {
  model: TypeMapPath[0] extends 'model' ? TypeMapPath[1] : undefined,
  operation: TypeMapPath[0] extends 'model' ? TypeMapPath[2] :TypeMapPath[1],
  args: DynamicQueryExtensionCbArgsArgs<TypeMap, TypeMapPath>,
  query: (args: DynamicQueryExtensionCbArgsArgs<TypeMap, TypeMapPath>) =>
    PrismaPromise<DynamicQueryExtensionCbResult<TypeMap, TypeMapPath>>
}

type DynamicQueryExtensionCbArgsArgs<TypeMap extends Record<string, any>, TypeMapPath extends (keyof any)[]> =
  TypeMapPath[1] extends '$queryRaw' | '$executeRaw'
  ? Sql // Override args type for raw queries
  : Path<TypeMap, [...TypeMapPath, 'args']>

type DynamicQueryExtensionCbResult<TypeMap extends Record<string, any>, TypeMapPath extends (keyof any)[]> =
  Path<TypeMap, [...TypeMapPath, 'result']>

/** Result */

export type DynamicResultExtensionArgs<R_, TypeMap extends Record<string, any>> = {
  [K in keyof R_]: {
    [P in keyof R_[K]]?: {
      needs?: DynamicResultExtensionNeeds<TypeMap, ModelKey<TypeMap, K>, R_[K][P]> 
      compute<D extends DynamicResultExtensionData<TypeMap, ModelKey<TypeMap, K>, Path<R_, [K, P]>>>(data: D): unknown
    }
  }
}

type DynamicResultExtensionNeeds<TypeMap extends Record<string, any>, M extends keyof any, S> = {
  [K in keyof S]: K extends keyof TypeMap['model'][M]['findFirstOrThrow']['payload']['scalars'] ? S[K] : never
} & {
  [N in keyof TypeMap['model'][M]['findFirstOrThrow']['payload']['scalars']]?: boolean
}

type DynamicResultExtensionData<TypeMap extends Record<string, any>, M extends keyof any, S> =
  GetFindResult<TypeMap['model'][M]['findFirstOrThrow']['payload'], { select: S }>

/** Model */

export type DynamicModelExtensionArgs<M_, TypeMap extends Record<string, any>, ExtArgs extends Record<string, any>> = {
  [K in keyof M_]:
    K extends '$allModels'
    ? & { [P in keyof M_[K]]?: unknown }
      & { [K: symbol]: {} }
    : K extends TypeMap['meta']['modelProps']
      ? & { [P in keyof M_[K]]?: unknown }
        & { [K: symbol]: { ctx: DynamicModelExtensionThis<TypeMap, ModelKey<TypeMap, K>, ExtArgs> & { name: ModelKey<TypeMap, K> } } }
      : never
}

type DynamicModelExtensionThis<TypeMap extends Record<string, any>, M extends keyof any, ExtArgs extends Record<string, any>> = {
  [P in keyof TypeMap['model'][M] | keyof ExtArgs['model'][Uncapitalize<M & string>]]:
    P extends Operation
    ? HasAllOptionalKeys<TypeMap['model'][M][P]['args']> extends 1
      ? <A extends TypeMap['model'][M][P]['args']>(args?: A) =>
          PrismaPromise<GetOperationResult<TypeMap['model'][M][P]['payload'], A, P>>
      : <A extends TypeMap['model'][M][P]['args']>(args: A) =>
          PrismaPromise<GetOperationResult<TypeMap['model'][M][P]['payload'], A, P>>
    : Return<ExtArgs['model'][Uncapitalize<M & string>][P]>
} & {
  [K: symbol]: { types: TypeMap['model'][M] }
}

/** Client */

export type DynamicClientExtensionArgs<C_, TypeMap extends Record<string, any>, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
  [P in keyof C_]: unknown
} & {
  [K: symbol]: { ctx: Optional<DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>, ITXClientDenyList> }
}

export type DynamicClientExtensionThis<TypeMap extends Record<any, any>, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
  [P in keyof TypeMap['other'] | keyof TypeMap['model'] | keyof ExtArgs['client'] as Uncapitalize<P & string>]:
    P extends Operation
    ? <A extends TypeMap['other'][P]['args']>(...args: A) =>
      PrismaPromise<GetOperationResult<TypeMap['other'][P]['payload'], A, P>>
    : P extends keyof TypeMap['model']
      ? DynamicModelExtensionThis<TypeMap, P, ExtArgs>
      : Return<ExtArgs['client'][P]>
} & {
  $extends: ExtendsHook<'extends', TypeMapCb, ExtArgs>
  $transaction<R>(fn: (client: Omit<DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>, ITXClientDenyList>, options?: { maxWait?: number, timeout?: number, isolationLevel?: string }) => Promise<R>): Promise<R>
  $transaction<P extends PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: string }): Promise<UnwrapTuple<P>>
  $disconnect(): Promise<void>
  $connect(): Promise<void>
}

/** $extends, defineExtension */

export interface ExtendsHook<Variant extends 'extends' | 'define', TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>, TypeMap extends Record<string, any> = Call<TypeMapCb, { extArgs: ExtArgs }>> {
  extArgs: ExtArgs,
  <
    // X_ seeds the first fields for auto-completion and deals with dynamic inference
    // X doesn't deal with dynamic inference but captures the final inferred input type
    Q_ extends { [K in TypeMap['meta']['modelProps'] | '$allModels' | keyof TypeMap['other'] | '$allOperations']?: unknown },
    R_ extends { [K in TypeMap['meta']['modelProps'] | '$allModels']?: unknown }, R,
    M_ extends { [K in TypeMap['meta']['modelProps'] | '$allModels']?: unknown }, M,
    C_ extends { [K in string]?: unknown }, C,
    Args extends InternalArgs = InternalArgs<{}, R, M, C>,
    MergedArgs extends InternalArgs = MergeExtArgs<TypeMap, ExtArgs, Args>
  >(extension:
    | ((client: DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>) => { $extends: { extArgs: Args } })
    | {
      name?: string
      query?: DynamicQueryExtensionArgs<Q_, TypeMap>
      result?: DynamicResultExtensionArgs<R_, TypeMap> & R
      model?: DynamicModelExtensionArgs<M_, TypeMap, ExtArgs> & M
      client?: DynamicClientExtensionArgs<C_, TypeMap, TypeMapCb, ExtArgs> & C
    }
  ): {
    'extends': DynamicClientExtensionThis<Call<TypeMapCb, { extArgs: MergedArgs }>, TypeMapCb, MergedArgs>
    'define': (client: any) => { $extends: { extArgs: Args } }
  }[Variant]
}

type MergeExtArgs<TypeMap extends Record<string,  any>, ExtArgs extends Record<any, any>, Args extends Record<any, any>> = 
  ComputeDeep<
    & ExtArgs
    & Args
    & AllModelsToStringIndex<TypeMap, Args, 'result'>
    & AllModelsToStringIndex<TypeMap, Args, 'model'>
  >

type AllModelsToStringIndex<TypeMap extends Record<string,  any>, Args extends Record<string, any>, K extends keyof any> =
  Args extends { [P in K]: { $allModels: infer AllModels} }
  ? { [P in K]: Record<TypeMap['meta']['modelProps'], AllModels> }
  : {}

/** Shared */

type TypeMapCbDef = Fn<{ extArgs: Args }, Record<string, any>>

type ModelKey<TypeMap extends Record<string, any>, M extends keyof any> =
  M extends keyof TypeMap['model']
  ? M & string
  : Capitalize<M & string>

export type { UserArgs }

import { Sql } from 'sql-template-tag'

import { ITXClientDenyList } from '../../itxClientDenyList'
import { RequiredArgs as UserArgs } from '../extensions/$extends'
import { GetFindResult, GetResult as GetOperationResult, Operation } from './GetResult'
import { Payload } from './Payload'
import { PrismaPromise } from './Public'
import { Call, ComputeDeep, Fn, Optional, Return, ToTuple, UnwrapTuple } from './Utils'

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

export type GetResult<Base extends Record<any, any>, R extends Args['result'][string], KR extends keyof R = string extends keyof R ? never : keyof R> =
  { [K in KR | keyof Base]: K extends KR ? R[K] extends (() => { compute: (...args: any) => infer C }) ? C : never : Base[K] }

export type GetSelect<Base extends Record<any, any>, R extends Args['result'][string], KR extends keyof R = string extends keyof R ? never : keyof R> =
  { [K in KR | keyof Base]?: K extends KR ? boolean : Base[K] }

/** Query */

export type DynamicQueryExtensionArgs<Q_, TypeMap extends TypeMapDef> = {
  [K in keyof Q_]:
    K extends '$allOperations'
    ? (args: { model?: string, operation: string, args: any, query: (args: any) => PrismaPromise<any> }) => Promise<any>
    : K extends '$allModels'
      ? {
          [P in keyof Q_[K] | keyof TypeMap['model'][keyof TypeMap['model']] | '$allOperations']?:
            P extends '$allOperations'
            ? DynamicQueryExtensionCb<TypeMap, 'model', keyof TypeMap['model'], keyof TypeMap['model'][keyof TypeMap['model']]>
            : P extends keyof TypeMap['model'][keyof TypeMap['model']]
              ? DynamicQueryExtensionCb<TypeMap, 'model', keyof TypeMap['model'], P>
              : never
        }
      : K extends TypeMap['meta']['modelProps']
        ? {
            [P in keyof Q_[K] | keyof TypeMap['model'][ModelKey<TypeMap, K>] | '$allOperations']?:
              P extends '$allOperations'
              ? DynamicQueryExtensionCb<TypeMap, 'model', ModelKey<TypeMap, K>, keyof TypeMap['model'][ModelKey<TypeMap, K>]>
              : P extends keyof TypeMap['model'][ModelKey<TypeMap, K>]
                ? DynamicQueryExtensionCb<TypeMap, 'model', ModelKey<TypeMap, K>, P>
                : never
          }
      : K extends keyof TypeMap['other']
        ? DynamicQueryExtensionCb<[TypeMap], 0 /* hack to maintain type arity */, 'other', K>
        : never
}

export type DynamicQueryExtensionCb<TypeMap extends TypeMapDef, _0 extends PropertyKey, _1 extends PropertyKey, _2 extends PropertyKey> =
  <A extends DynamicQueryExtensionCbArgs<TypeMap, _0, _1, _2>>(args: A) =>
    Promise<TypeMap[_0][_1][_2]['result']>

export type DynamicQueryExtensionCbArgs<TypeMap extends TypeMapDef, _0 extends PropertyKey, _1 extends PropertyKey, _2 extends PropertyKey> =
  ( // we distribute over the union of models and operations to allow narrowing
    _1 extends unknown ? _2 extends unknown ? {
      args: DynamicQueryExtensionCbArgsArgs<TypeMap, _0, _1, _2>,
      model: _0 extends 0 ? undefined : _1,
      operation: _2,
    } : never : never
  ) & { // but we don't distribute for query so that the input types stay union
    query: (args: DynamicQueryExtensionCbArgsArgs<TypeMap, _0, _1, _2>) =>
      PrismaPromise<TypeMap[_0][_1][_2]['result']>
  }

export type DynamicQueryExtensionCbArgsArgs<TypeMap extends TypeMapDef, _0 extends PropertyKey, _1 extends PropertyKey, _2 extends PropertyKey> =
  _2 extends '$queryRaw' | '$executeRaw'
  ? Sql // Override args type for raw queries
  : TypeMap[_0][_1][_2]['args']

/** Result */

export type DynamicResultExtensionArgs<R_, TypeMap extends TypeMapDef> = {
  [K in keyof R_]: {
    [P in keyof R_[K]]?: {
      needs?: DynamicResultExtensionNeeds<TypeMap, ModelKey<TypeMap, K>, R_[K][P]> 
      compute(data: DynamicResultExtensionData<TypeMap, ModelKey<TypeMap, K>, R_[K][P]>): any
    }
  }
}

export type DynamicResultExtensionNeeds<TypeMap extends TypeMapDef, M extends PropertyKey, S> = {
  [K in keyof S]: K extends keyof TypeMap['model'][M]['findFirstOrThrow']['payload']['scalars'] ? S[K] : never
} & {
  [N in keyof TypeMap['model'][M]['findFirstOrThrow']['payload']['scalars']]?: boolean
}

export type DynamicResultExtensionData<TypeMap extends TypeMapDef, M extends PropertyKey, S> =
  GetFindResult<TypeMap['model'][M]['findFirstOrThrow']['payload'], { select: S }>

/** Model */

export type DynamicModelExtensionArgs<M_, TypeMap extends TypeMapDef, ExtArgs extends Record<string, any>> = {
  [K in keyof M_]:
    K extends '$allModels'
    ? & { [P in keyof M_[K]]?: unknown }
      & { [K: symbol]: {} }
    : K extends TypeMap['meta']['modelProps']
      ? & { [P in keyof M_[K]]?: unknown }
        & { [K: symbol]: { ctx: DynamicModelExtensionThis<TypeMap, ModelKey<TypeMap, K>, ExtArgs> & { name: ModelKey<TypeMap, K> } } }
      : never
}

export type DynamicModelExtensionThis<TypeMap extends TypeMapDef, M extends PropertyKey, ExtArgs extends Record<string, any>> = {
  [P in keyof ExtArgs['model'][Uncapitalize<M & string>]]:
    Return<ExtArgs['model'][Uncapitalize<M & string>][P]>
} & {
  [P in Exclude<keyof TypeMap['model'][M], keyof ExtArgs['model'][Uncapitalize<M & string>]>]:
    {} extends TypeMap['model'][M][P]['args'] // will match fully optional args
    ? <A extends TypeMap['model'][M][P]['args']>(args?: A) =>
        PrismaPromise<GetOperationResult<TypeMap['model'][M][P]['payload'], A, P & Operation>>
    : <A extends TypeMap['model'][M][P]['args']>(args: A) =>
        PrismaPromise<GetOperationResult<TypeMap['model'][M][P]['payload'], A, P & Operation>>
} & {
  [K: symbol]: { types: TypeMap['model'][M] }
}

/** Client */

export type DynamicClientExtensionArgs<C_, TypeMap extends TypeMapDef, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
  [P in keyof C_]: unknown
} & {
  [K: symbol]: { ctx: Optional<DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>, ITXClientDenyList> }
}

export type DynamicClientExtensionThis<TypeMap extends TypeMapDef, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
  [P in keyof ExtArgs['client']]: Return<ExtArgs['client'][P]>
} & {
  [P in Exclude<TypeMap['meta']['modelProps'], keyof ExtArgs['client']>]:
    DynamicModelExtensionThis<TypeMap, ModelKey<TypeMap, P>, ExtArgs>
} & {
  [P in Exclude<keyof TypeMap['other'], keyof ExtArgs['client']>]:
    <R = GetOperationResult<TypeMap['other'][P]['payload'], any, P & Operation>>
    (...args: ToTuple<TypeMap['other'][P]['args']>) => PrismaPromise<R>
} & {
  [P in Exclude<ClientBuiltInProp, keyof ExtArgs['client']>]:
    DynamicClientExtensionThisBuiltin<TypeMap, TypeMapCb, ExtArgs>[P]
}

export type ClientBuiltInProp = '$connect' | '$disconnect' | '$transaction' | '$extends'
export type DynamicClientExtensionThisBuiltin<TypeMap extends TypeMapDef, TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>> = {
  $extends: ExtendsHook<'extends', TypeMapCb, ExtArgs>
  $transaction<P extends PrismaPromise<any>[]>(arg: [...P], options?: { isolationLevel?: TypeMap['meta']['txIsolationLevel'] }): Promise<UnwrapTuple<P>>
  $transaction<R>(fn: (client: Omit<DynamicClientExtensionThis<TypeMap, TypeMapCb, ExtArgs>, ITXClientDenyList>) => Promise<R>, options?: { maxWait?: number, timeout?: number, isolationLevel?: TypeMap['meta']['txIsolationLevel'] }): Promise<R>
  $disconnect(): Promise<void>
  $connect(): Promise<void>
}

/** $extends, defineExtension */

export interface ExtendsHook<Variant extends 'extends' | 'define', TypeMapCb extends TypeMapCbDef, ExtArgs extends Record<string, any>, TypeMap extends TypeMapDef = Call<TypeMapCb, { extArgs: ExtArgs }>> {
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

export type MergeExtArgs<TypeMap extends TypeMapDef, ExtArgs extends Record<any, any>, Args extends Record<any, any>> = 
  ComputeDeep<
    & ExtArgs
    & Args
    & AllModelsToStringIndex<TypeMap, Args, 'result'>
    & AllModelsToStringIndex<TypeMap, Args, 'model'>
  >

export type AllModelsToStringIndex<TypeMap extends TypeMapDef, Args extends Record<string, any>, K extends PropertyKey> =
  Args extends { [P in K]: { $allModels: infer AllModels} }
  ? { [P in K]: Record<TypeMap['meta']['modelProps'], AllModels> }
  : {}

/** Shared */

type TypeMapDef = Record<any, any> /* DevTypeMapDef */

// eslint-disable-next-line @typescript-eslint/no-unused-vars
type DevTypeMapDef = {
  meta: {
    modelProps: string
  },
  model: {
    [Model in PropertyKey]: {
      [Operation in PropertyKey]: DevTypeMapFnDef
    }
  },
  other: {
    [Operation in PropertyKey]: DevTypeMapFnDef
  }
}

type DevTypeMapFnDef = {
  args: any
  result: any
  payload: Payload
}

type TypeMapCbDef = Fn<{ extArgs: Args }, TypeMapDef>

type ModelKey<TypeMap extends TypeMapDef, M extends PropertyKey> =
  M extends keyof TypeMap['model']
  ? M
  : Capitalize<M & string>

export type { UserArgs }

import { Operation } from '@prisma/client-common'

import { JsonObject } from './Json'
import { OperationPayload } from './Payload'
import { Skip } from './Skip'
import { Compute, Equals, PatchFlat, Select } from './Utils'

export type Count<O> = { [K in keyof O]: Count<number> } & {}

// prettier-ignore
export type GetFindResult<P extends OperationPayload, A, GlobalOmitOptions> =
  Equals<A, any> extends 1 ? DefaultSelection<P, A, GlobalOmitOptions> :
  A extends
  | { select: infer S extends object } & Record<string, unknown>
  | { include: infer I extends object } & Record<string, unknown>
  ? {
      [K in keyof S | keyof I as (S & I)[K] extends false | undefined | Skip | null ? never : K]:
        (S & I)[K] extends object
        ? P extends SelectablePayloadFields<K, (infer O)[]>
          ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], GlobalOmitOptions>[] : never
          : P extends SelectablePayloadFields<K, infer O | null>
            ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], GlobalOmitOptions> | SelectField<P, K> & null : never
            : K extends '_count'
              ? Count<GetFindResult<P, (S & I)[K], GlobalOmitOptions>>
              : never
        : P extends SelectablePayloadFields<K, (infer O)[]>
          ? O extends OperationPayload ? DefaultSelection<O, {}, GlobalOmitOptions>[] : never
          : P extends SelectablePayloadFields<K, infer O | null>
            ? O extends OperationPayload ? DefaultSelection<O, {}, GlobalOmitOptions> | SelectField<P, K> & null : never
            : P extends { scalars: { [k in K]: infer O } }
              ? O
              : K extends '_count'
                ? Count<P['objects']>
                : never
    } & (
      A extends { include: any } & Record<string, unknown>
        // The `A & { omit: ['omit'] }` hack is necessary because otherwise, when we have nested `select` or `include`,
        // TypeScript at some point gives up remembering what keys `A` has exactly and discards the `omit` for whatever
        // reason. Splitting the top-level conditional type above into two separate branches and handling `select` and
        // `include` separately so we don't need to use `A extends { include: any } & Record<string, unknown>` above in
        // this branch here makes zero difference. Re-adding the `omit` key here makes TypeScript remember it.
        ? DefaultSelection<P, A & { omit: A['omit'] }, GlobalOmitOptions>
        : unknown
    )
  : DefaultSelection<P, A, GlobalOmitOptions>

// prettier-ignore
export type SelectablePayloadFields<K extends PropertyKey, O> =
  | { objects: { [k in K]: O } }
  | { composites: { [k in K]: O } }

// prettier-ignore
export type SelectField<P extends SelectablePayloadFields<any, any>, K extends PropertyKey> =
  P extends { objects: Record<K, any> }
  ? P['objects'][K]
  : P extends { composites: Record<K, any> }
    ? P['composites'][K]
    : never

// prettier-ignore
export type DefaultSelection<Payload extends OperationPayload, Args = {}, GlobalOmitOptions = {}> =
  Args extends { omit: infer LocalOmit }
    // Both local and global omit, local settings override globals
    ? ApplyOmit<UnwrapPayload<{ default: Payload }>['default'], PatchFlat<LocalOmit, ExtractGlobalOmit<GlobalOmitOptions, Uncapitalize<Payload['name']>>>>
    // global only
    : ApplyOmit<UnwrapPayload<{ default: Payload }>['default'], ExtractGlobalOmit<GlobalOmitOptions, Uncapitalize<Payload['name']>>>

// prettier-ignore
export type UnwrapPayload<P> = {} extends P ? unknown : {
  [K in keyof P]:
    P[K] extends { scalars: infer S, composites: infer C }[]
    ? Array<S & UnwrapPayload<C>>
    : P[K] extends { scalars: infer S, composites: infer C } | null
      ? S & UnwrapPayload<C> | Select<P[K], null>
      : never
};

export type ApplyOmit<T, OmitConfig> = Compute<{
  [K in keyof T as OmitValue<OmitConfig, K> extends true ? never : K]: T[K]
}>

export type OmitValue<Omit, Key> = Key extends keyof Omit ? Omit[Key] : false

export type GetCountResult<A> = A extends { select: infer S } ? (S extends true ? number : Count<S>) : number

export type Aggregate = '_count' | '_max' | '_min' | '_avg' | '_sum'

// prettier-ignore
export type GetAggregateResult<P extends OperationPayload, A> = {
  [K in keyof A as K extends Aggregate ? K : never]:
    K extends '_count'
    ? A[K] extends true ? number : Count<A[K]>
    : { [J in keyof A[K] & string]: P['scalars'][J] | null }
}

export type GetBatchResult = { count: number }

// prettier-ignore
export type GetGroupByResult<P extends OperationPayload, A> =
  A extends { by: string[] }
  ? Array<GetAggregateResult<P, A> & { [K in A['by'][number]]: P['scalars'][K] }>
  : A extends { by: string }
    ? Array<GetAggregateResult<P, A> & { [K in A['by']]: P['scalars'][K]}>
    : {}[]

// prettier-ignore
export type GetResult<Payload extends OperationPayload, Args, OperationName extends Operation = 'findUniqueOrThrow', GlobalOmitOptions = {}> = {
  findUnique: GetFindResult<Payload, Args, GlobalOmitOptions> | null,
  findUniqueOrThrow: GetFindResult<Payload, Args, GlobalOmitOptions>,
  findFirst: GetFindResult<Payload, Args, GlobalOmitOptions> | null,
  findFirstOrThrow: GetFindResult<Payload, Args, GlobalOmitOptions>,
  findMany: GetFindResult<Payload, Args, GlobalOmitOptions>[],
  create: GetFindResult<Payload, Args, GlobalOmitOptions>,
  createMany: GetBatchResult,
  createManyAndReturn: GetFindResult<Payload, Args, GlobalOmitOptions>[],
  update: GetFindResult<Payload, Args, GlobalOmitOptions>,
  updateMany: GetBatchResult,
  updateManyAndReturn: GetFindResult<Payload, Args, GlobalOmitOptions>[],
  upsert: GetFindResult<Payload, Args, GlobalOmitOptions>,
  delete: GetFindResult<Payload, Args, GlobalOmitOptions>,
  deleteMany: GetBatchResult,
  aggregate: GetAggregateResult<Payload, Args>,
  count: GetCountResult<Args>,
  groupBy: GetGroupByResult<Payload, Args>,
  $queryRaw: unknown,
  $queryRawTyped: unknown,
  $executeRaw: number,
  $queryRawUnsafe: unknown,
  $executeRawUnsafe: number,
  $runCommandRaw: JsonObject,
  findRaw: JsonObject,
  aggregateRaw: JsonObject,
}[OperationName]

// prettier-ignore
export type ExtractGlobalOmit<Options, ModelName extends string> =
  Options extends { omit: { [K in ModelName]: infer GlobalOmit } }
  ? GlobalOmit
  : {}

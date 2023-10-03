/* eslint-disable prettier/prettier */

import { OperationPayload } from './Payload'
import { Equals, JsonObject, Select } from './Utils'

// prettier-ignore
export type Operation =
// finds
| 'findFirst'
| 'findFirstOrThrow'
| 'findUnique'
| 'findUniqueOrThrow'
| 'findMany'
// creates
| 'create'
| 'createMany'
// updates
| 'update'
| 'updateMany'
| 'upsert'
// deletes
| 'delete'
| 'deleteMany'
// aggregates
| 'aggregate'
| 'count'
| 'groupBy'
// raw sql
| '$queryRaw'
| '$executeRaw'
| '$queryRawUnsafe'
| '$executeRawUnsafe'
// raw mongo
| 'findRaw'
| 'aggregateRaw'
| '$runCommandRaw'

export type FluentOperation =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'create'
  | 'update'
  | 'upsert'
  | 'delete'

export type Count<O> = { [K in keyof O]: Count<number> } & {}

// prettier-ignore
export type GetFindResult<P extends OperationPayload, A> =
  Equals<A, any> extends 1 ? DefaultSelection<P> :
  A extends
  | { select: infer S extends object } & Record<string, unknown>
  | { include: infer I extends object } & Record<string, unknown>
  ? {
      [K in keyof S | keyof I as (S & I)[K] extends false | undefined | null ? never : K]:
        (S & I)[K] extends object
        ? P extends SelectablePayloadFields<K, (infer O)[]>
          ? O extends OperationPayload ? GetFindResult<O, (S & I)[K]>[] : never
          : P extends SelectablePayloadFields<K, infer O | null>
            ? O extends OperationPayload ? GetFindResult<O, (S & I)[K]> | SelectField<P, K> & null : never
            : K extends '_count'
              ? Count<GetFindResult<P, (S & I)[K]>>
              : never
        : P extends SelectablePayloadFields<K, (infer O)[]>
          ? O extends OperationPayload ? DefaultSelection<O>[] : never
          : P extends SelectablePayloadFields<K, infer O | null>
            ? O extends OperationPayload ? DefaultSelection<O> | SelectField<P, K> & null : never
            : P extends { scalars: { [k in K]: infer O } }
              ? O
              : K extends '_count'
                ? Count<P['objects']>
                : never
    } & (A extends { include: any } & Record<string, unknown> ? DefaultSelection<P> : unknown)
  : DefaultSelection<P>

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
export type DefaultSelection<P> = UnwrapPayload<{ default: P }>['default']

// prettier-ignore
export type UnwrapPayload<P> = {} extends P ? unknown : {
  [K in keyof P]: 
    P[K] extends { scalars: infer S, composites: infer C }[]
    ? Array<S & UnwrapPayload<C>>
    : P[K] extends { scalars: infer S, composites: infer C } | null
      ? S & UnwrapPayload<C> | Select<P[K], null>
      : never
};

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
export type GetResult<P extends OperationPayload, A, O extends Operation = 'findUniqueOrThrow'> = {
  findUnique: GetFindResult<P, A> | null,
  findUniqueOrThrow: GetFindResult<P, A>,
  findFirst: GetFindResult<P, A> | null,
  findFirstOrThrow: GetFindResult<P, A>,
  findMany: GetFindResult<P, A>[],
  create: GetFindResult<P, A>,
  createMany: GetBatchResult,
  update: GetFindResult<P, A>,
  updateMany: GetBatchResult,
  upsert: GetFindResult<P, A>,
  delete: GetFindResult<P, A>,
  deleteMany: GetBatchResult,
  aggregate: GetAggregateResult<P, A>,
  count: GetCountResult<A>,
  groupBy: GetGroupByResult<P, A>,
  $queryRaw: unknown,
  $executeRaw: number,
  $queryRawUnsafe: unknown,
  $executeRawUnsafe: number,
  $runCommandRaw: JsonObject,
  findRaw: JsonObject,
  aggregateRaw: JsonObject,
}[O]

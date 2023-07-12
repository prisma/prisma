/* eslint-disable prettier/prettier */

import { Payload } from './Payload'
import { JsonObject } from './Utils'

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

type Count<O> = { [K in keyof O]: Count<number> } & {}

// prettier-ignore
export type GetFindResult<P extends Payload, A> =
  {} extends A ? DefaultSelection<P> :
  A extends 
  | { select: infer S } & Record<string, unknown>
  | { include: infer S } & Record<string, unknown>
  ? S extends undefined ? DefaultSelection<P> :
    {
      [K in keyof S as S[K] extends false | undefined | null ? never : K]:
        S[K] extends object
        ? P extends SelectablePayloadFields<K, (infer O)[]>
          ? O extends Payload ? GetFindResult<O, S[K]>[] : never
          : P extends SelectablePayloadFields<K, infer O | null>
            ? O extends Payload ? GetFindResult<O, S[K]> | SelectField<P, K> & null : never
            : K extends '_count'
              ? Count<GetFindResult<P, S[K]>>
              : never
        : P extends SelectablePayloadFields<K, (infer O)[]>
          ? O extends Payload ? DefaultSelection<O>[] : never
          : P extends SelectablePayloadFields<K, infer O | null>
            ? O extends Payload ? DefaultSelection<O> | SelectField<P, K> & null : never
            : P extends { scalars: { [k in K]: infer O } }
              ? O
              : K extends '_count'
                ? Count<P['objects']>
                : never
    } & (A extends { include: any } & Record<string, unknown> ? DefaultSelection<P> : unknown)
  : DefaultSelection<P>

// prettier-ignore
type SelectablePayloadFields<K extends PropertyKey, O> =
  | { objects: { [k in K]: O } }
  | { composites: { [k in K]: O } }

// prettier-ignore
type SelectField<P extends SelectablePayloadFields<any, any>, K extends PropertyKey> = 
  P extends { objects: Record<K, any> } 
  ? P['objects'][K]
  : P extends { composites: Record<K, any> }
    ? P['composites'][K]
    : never

// prettier-ignore
export type DefaultSelection<P> = P extends Payload 
  ? P['scalars'] & UnwrapPayload<P['composites']>
  : P

// prettier-ignore
type UnwrapPayload<P> = {
  [K in keyof P]:
    P[K] extends Payload[]
    ? UnwrapPayload<P[K]>
    : P[K] extends Payload 
      ? P[K]['scalars'] & UnwrapPayload<P[K]['composites']> 
      : P[K] extends infer O | null 
        ? O extends Payload 
          ? (O['scalars'] & UnwrapPayload<O['composites']>) | null
        : P[K]
      : P[K]
} & unknown

type GetCountResult<A> = A extends { select: infer S } ? (S extends true ? number : Count<S>) : number

type Aggregate = '_count' | '_max' | '_min' | '_avg' | '_sum'

// prettier-ignore
type GetAggregateResult<P extends Payload, A> = {
  [K in keyof A as K extends Aggregate ? K : never]:
    K extends '_count'
    ? A[K] extends true ? number : Count<A[K]>
    : { [J in keyof A[K] & string]: P['scalars'][J] | null }
}

type GetBatchResult = { count: number }

// prettier-ignore
type GetGroupByResult<P extends Payload, A> =
  A extends { by: string[] }
  ? Array<GetAggregateResult<P, A> & { [K in A['by'][number]]: P['scalars'][K] }>
  : never

// prettier-ignore
export type GetResult<P extends Payload, A, O extends Operation = 'findUniqueOrThrow'> = {
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

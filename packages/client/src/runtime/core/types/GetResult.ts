/* eslint-disable prettier/prettier */

import { Payload } from "./Payload"
import { JsonObject } from "./Utils"

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

type Count<O> = { [K in keyof O]: Count<number> } & {}

// prettier-ignore
type GetFindResult<P extends Payload, A> = 
  A extends 
  | { select: infer S } & Record<string, unknown>
  | { include: infer S } & Record<string, unknown>
  ? {
      [K in keyof S as S[K] extends false | undefined | null ? never : K]:
        S[K] extends object
        ? P extends { objects: { [k in K]: (infer O)[] } }
          ? O extends Payload ? GetFindResult<O, S[K]>[] : never
          : P extends { objects: { [k in K]: (infer O) | null } }
            ? O extends Payload ? GetFindResult<O, S[K]> | P['objects'][K] & null : never
            : K extends '_count'
              ? Count<GetFindResult<P, S[K]>>
              : never
        : P extends { objects: { [k in K]: (infer O)[] } }
          ? O extends Payload ? O['scalars'][] : never
          : P extends { objects: { [k in K]: (infer O) | null } }
            ? O extends Payload ? O['scalars'] | P['objects'][K] & null : never
            : P extends { scalars: { [k in K]: infer O } }
              ? O
              : K extends '_count'
                ? Count<P['objects']>
                : never
    } & (A extends { include: any } & Record<string, unknown> ? P['scalars'] & P['composites'] : unknown)
  : P['scalars'] & P['composites']

type GetCountResult<A> = A extends { select: infer S } ? (S extends true ? number : Count<S>) : number

type Aggregate = '_count' | '_max' | '_min' | '_avg' | '_sum'
type GetAggregateResult<P extends Payload, A> = {
  [K in keyof A as K extends Aggregate ? K : never]:
    K extends '_count'
    ? A[K] extends true ? number : Count<A[K]>
    : { [J in keyof A[K] & string]: P['scalars'][J] | null }
}

type GetBatchResult = { count: number }

type GetGroupByResult<P extends Payload, A> =
  A extends { by: string[] }
  ? Array<GetAggregateResult<P, A> & { [K in A['by'][number]]: P['scalars'][K] }>
  : never

// TODO Null can be removed once rejectOnNotFound is removed
export type GetResult<P extends Payload, A, O extends Operation = 'findUniqueOrThrow', Null = null> = {
  findUnique: GetFindResult<P, A> | Null,
  findUniqueOrThrow: GetFindResult<P, A>,
  findFirst: GetFindResult<P, A> | Null,
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

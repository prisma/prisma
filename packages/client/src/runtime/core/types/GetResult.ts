/* eslint-disable prettier/prettier */

import { Payload } from "./Payload"

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
// raw mongo
// | 'findRaw'
// | 'runCommandRaw'

type Count<O> = { [K in keyof O]: Count<number> } & {}

type GetFindResult<P extends Payload, A> = 
  A extends { select: infer S } | { include: infer S }
  ? {
      [K in keyof S as S[K] extends false | undefined | null ? never : K]:
        S[K] extends true
        ? P extends { objects: { [k in K]: (infer O)[] } }
          ? O extends Payload ? O['scalars'][] : never
          : P extends { objects: { [k in K]: (infer O) | null } }
            ? O extends Payload ? O['scalars'] | P['objects'][K] & null : never
            : P extends { scalars: { [k in K]: infer O } }
              ? O
              : K extends '_count'
                ? Count<P['objects']>
                : never
        : P extends { objects: { [k in K]: (infer O)[] } }
          ? O extends Payload ? GetFindResult<O, S[K]>[] : never
          : P extends { objects: { [k in K]: (infer O) | null } }
            ? O extends Payload ? GetFindResult<O, S[K]> | P['objects'][K] & null : never
            : K extends '_count'
              ? Count<GetFindResult<P, S[K]>>
              : never
  } & (A extends { include: any } ? P['scalars'] : unknown)
  : P['scalars']

type GetCountResult<P, A> =
  A extends { select: infer S }
  ? S extends true
    ? number
    : Count<S>
  : number

type Aggregate = '_count' | '_max' | '_min' | '_avg' | '_sum' 
type GetAggregateResult<P, A> = {
  [K in keyof A as K extends Aggregate ? K : never]:
    K extends '_count'
    ? A[K] extends true
      ? number
      : Count<A[K]>
    : Count<A[K]>
}

type GetBatchResult<P, A> = { count: number }

type GetGroupByResult<P, A> =
  P extends Payload
  ? A extends { by: string[] }
    ? Array<GetAggregateResult<P, A> & { [K in A['by'][number]]: P['scalars'][K] }>
    : never
  : never

export type GetResult<P extends Payload, A, O extends Operation> = {
  findUnique: GetFindResult<P, A>,
  findUniqueOrThrow: GetFindResult<P, A>,
  findFirst: GetFindResult<P, A>,
  findFirstOrThrow: GetFindResult<P, A>,
  findMany: GetFindResult<P, A>[],
  create: GetFindResult<P, A>,
  createMany: GetBatchResult<P, A>,
  update: GetFindResult<P, A>,
  updateMany: GetBatchResult<P, A>,
  upsert: GetFindResult<P, A>,
  delete: GetFindResult<P, A>,
  deleteMany: GetBatchResult<P, A>,
  aggregate: GetAggregateResult<P, A>,
  count: GetCountResult<P, A>
  groupBy: GetGroupByResult<P, A>
}[O]

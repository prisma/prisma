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

type ObjectsOf<P extends Payload> = P['objects']
type ScalarsOf<P extends Payload> = P['scalars']
type AllOf<P extends Payload> = P['objects'] & P['scalars']

type Count<O> = { [K in keyof O]: Count<number> } & {}

type GetFindResult<P, A, R extends 'objects' | 'scalars' = 'scalars'> =
  // Args extends { select: any, include: any } ? 'Please either choose `select` or `include`' :
  P extends Payload
  ? A extends { include: any }
    ? ScalarsOf<P> & {
      [K in keyof A['include'] as A['include'][K] extends false | undefined | null ? never : K]:
        K extends '_count' ? Count<GetFindResult<P, A['include'][K], 'objects'>> :
        ObjectsOf<P>[K] extends any[] ? Array<GetFindResult<ObjectsOf<P>[K][number], A['include'][K]>> :
        ObjectsOf<P>[K] extends object ? GetFindResult<ObjectsOf<P>[K], A['include'][K]> :
        GetFindResult<ObjectsOf<P>[K], A['include'][K]>
    }
    : A extends { select: any }
    ? {
      [K in keyof A['select'] as A['select'][K] extends false | undefined | null ? never : K]:
        K extends '_count' ? Count<GetFindResult<P, A['select'][K], 'objects'>> :
        AllOf<P>[K] extends any[] ? Array<GetFindResult<AllOf<P>[K][number], A['select'][K]>> :
        AllOf<P>[K] extends object ? GetFindResult<AllOf<P>[K], A['select'][K]> :
        GetFindResult<AllOf<P>[K], A['select'][K]>
    }
    : { scalars: ScalarsOf<P>, objects: ObjectsOf<P> }[R]
  : P

type GetCountResult<P, A> =
  P extends Payload
  ? A extends { select: any }
    ? A extends { select : true }
      ? number
      : Count<A['select']>
    : number
  : never

type Aggregate = '_count' | '_max' | '_min' | '_avg' | '_sum' 
type GetAggregateResult<P, A> =
  P extends Payload
  ? {
      [K in keyof A as K extends Aggregate ? K : never]:
        K extends '_count'
        ? A[K] extends true
          ? number
          : Count<A[K]>
        : Count<A[K]>
    }
  : never

type GetBatchResult<P, A> = { count: number }

type GetGroupByResult<P, A> =
  P extends Payload
  ? A extends { by: string[] }
    ? Array<GetAggregateResult<P, A> & { [K in A['by'][number]]: P['scalars'][K] }>
    : never
  : never

export type GetResult<P, A, O extends Operation> = {
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

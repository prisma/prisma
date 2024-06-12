import { OperationPayload } from './Payload'
import { Compute, Equals, JsonObject, PatchFlat, Select } from './Utils'

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
| 'createManyAndReturn'
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
export type GetFindResult<P extends OperationPayload, A, ClientOptions> =
  Equals<A, any> extends 1 ? DefaultSelection<P, A, ClientOptions> :
  A extends
  | { select: infer S extends object } & Record<string, unknown>
  | { include: infer I extends object } & Record<string, unknown>
  ? {
      [K in keyof S | keyof I as (S & I)[K] extends false | undefined | null ? never : K]:
        (S & I)[K] extends object
        ? P extends SelectablePayloadFields<K, (infer O)[]>
          ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], ClientOptions>[] : never
          : P extends SelectablePayloadFields<K, infer O | null>
            ? O extends OperationPayload ? GetFindResult<O, (S & I)[K], ClientOptions> | SelectField<P, K> & null : never
            : K extends '_count'
              ? Count<GetFindResult<P, (S & I)[K], ClientOptions>>
              : never
        : P extends SelectablePayloadFields<K, (infer O)[]>
          ? O extends OperationPayload ? DefaultSelection<O, {}, ClientOptions>[] : never
          : P extends SelectablePayloadFields<K, infer O | null>
            ? O extends OperationPayload ? DefaultSelection<O, {}, ClientOptions> | SelectField<P, K> & null : never
            : P extends { scalars: { [k in K]: infer O } }
              ? O
              : K extends '_count'
                ? Count<P['objects']>
                : never
    } & (A extends { include: any } & Record<string, unknown> ? DefaultSelection<P, A, ClientOptions> : unknown)
  : DefaultSelection<P, A, ClientOptions>

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
export type DefaultSelection<P extends OperationPayload, Args = {}, ClientOptions = {}> =
  Args extends { omit: infer LocalOmit }
    // Both local and global omit, local settings override globals
    ? ApplyOmit<UnwrapPayload<{ default: P }>['default'], PatchFlat<LocalOmit, ExtractGlobalOmit<ClientOptions, Uncapitalize<P['name']>>>>
    // global only
    : ApplyOmit<UnwrapPayload<{ default: P }>['default'], ExtractGlobalOmit<ClientOptions, Uncapitalize<P['name']>>>

// prettier-ignore
export type UnwrapPayload<P> = {} extends P ? unknown : {
  [K in keyof P]: 
    P[K] extends { scalars: infer S, composites: infer C }[]
    ? Array<S & UnwrapPayload<C>>
    : P[K] extends { scalars: infer S, composites: infer C } | null
      ? S & UnwrapPayload<C> | Select<P[K], null>
      : never
};

export type ApplyOmit<T, Omit> = Compute<{
  [K in keyof T as OmitValue<Omit, K> extends true ? never : K]: T[K]
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
export type GetResult<Payload extends OperationPayload, Args, OperationName extends Operation = 'findUniqueOrThrow', ClientOptions = {}> = {
  findUnique: GetFindResult<Payload, Args, ClientOptions> | null,
  findUniqueOrThrow: GetFindResult<Payload, Args, ClientOptions>,
  findFirst: GetFindResult<Payload, Args, ClientOptions> | null,
  findFirstOrThrow: GetFindResult<Payload, Args, ClientOptions>,
  findMany: GetFindResult<Payload, Args, ClientOptions>[],
  create: GetFindResult<Payload, Args, ClientOptions>,
  createMany: GetBatchResult,
  createManyAndReturn: GetFindResult<Payload, Args, ClientOptions>[],
  update: GetFindResult<Payload, Args, ClientOptions>,
  updateMany: GetBatchResult,
  upsert: GetFindResult<Payload, Args, ClientOptions>,
  delete: GetFindResult<Payload, Args, ClientOptions>,
  deleteMany: GetBatchResult,
  aggregate: GetAggregateResult<Payload, Args>,
  count: GetCountResult<Args>,
  groupBy: GetGroupByResult<Payload, Args>,
  $queryRaw: unknown,
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

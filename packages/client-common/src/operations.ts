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
  | 'updateManyAndReturn'
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

export type NonModelOperation =
  | '$queryRaw'
  | '$queryRawTyped'
  | '$queryRawUnsafe'
  | '$executeRaw'
  | '$executeRawUnsafe'
  | '$runCommandRaw'

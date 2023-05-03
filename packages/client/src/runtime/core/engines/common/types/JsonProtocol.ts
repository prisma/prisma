import * as Transaction from './Transaction'

export type JsonQuery = {
  modelName?: string
  action: JsonQueryAction
  query: JsonFieldSelection
}

export type JsonBatchQuery = {
  batch: JsonQuery[]
  transaction?: { isolationLevel?: Transaction.IsolationLevel }
}

export type JsonQueryAction =
  | 'findUnique'
  | 'findUniqueOrThrow'
  | 'findFirst'
  | 'findFirstOrThrow'
  | 'findMany'
  | 'createOne'
  | 'createMany'
  | 'updateOne'
  | 'updateMany'
  | 'deleteOne'
  | 'deleteMany'
  | 'upsertOne'
  | 'aggregate'
  | 'groupBy'
  | 'executeRaw'
  | 'queryRaw'
  | 'runCommandRaw'
  | 'findRaw'
  | 'aggregateRaw'

export type JsonFieldSelection = {
  arguments?: Record<string, JsonArgumentValue>
  selection: JsonSelectionSet
}

export type JsonSelectionSet = {
  $scalars?: boolean
  $composites?: boolean
} & {
  [fieldName: string]: boolean | JsonFieldSelection
}

export type JsonArgumentValue =
  | number
  | string
  | boolean
  | null
  | JsonTaggedValue
  | JsonArgumentValue[]
  | { [key: string]: JsonArgumentValue }

export type DateTaggedValue = { $type: 'DateTime'; value: string }
export type DecimalTaggedValue = { $type: 'Decimal'; value: string }
export type BytesTaggedValue = { $type: 'Bytes'; value: string }
export type BigIntTaggedValue = { $type: 'BigInt'; value: string }
export type FieldRefTaggedValue = { $type: 'FieldRef'; value: { _ref: string } }
export type EnumTaggedValue = { $type: 'Enum'; value: string }
export type JsonTaggedValue = { $type: 'Json'; value: string }

export type JsonInputTaggedValue =
  | DateTaggedValue
  | DecimalTaggedValue
  | BytesTaggedValue
  | BigIntTaggedValue
  | FieldRefTaggedValue
  | JsonTaggedValue
  | EnumTaggedValue

export type JsonOutputTaggedValue =
  | DateTaggedValue
  | DecimalTaggedValue
  | BytesTaggedValue
  | BigIntTaggedValue
  | JsonTaggedValue

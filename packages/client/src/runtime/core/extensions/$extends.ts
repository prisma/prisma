import { Client } from '../../getPrismaClient'
import { RequestParams } from '../../RequestHandler'
import type { Fetch, IsolationLevel } from '../engines'
import {
  applyModelsAndClientExtensions,
  unApplyModelsAndClientExtensions,
} from '../model/applyModelsAndClientExtensions'
import { RawQueryArgs } from '../raw-query/RawQueryArgs'
import { JsArgs } from '../types/JsApi'
import { OptionalFlat } from '../types/Utils'

export type Args = OptionalFlat<RequiredArgs>
export type RequiredArgs = NameArgs & ResultArgs & ModelArgs & ClientArgs & QueryOptions

type NameArgs = {
  name?: string
}

type ResultArgs = {
  result: {
    [ModelName in string]: ResultArg
  }
}

export type ResultArgsFieldCompute = (model: any) => unknown

export type ResultArg = {
  [FieldName in string]: ResultFieldDefinition
}

export type ResultFieldDefinition = {
  needs?: { [FieldName in string]: boolean }
  compute: ResultArgsFieldCompute
}

export type ModelArgs = {
  model: {
    [ModelName in string]: ModelArg
  }
}

export type ModelArg = {
  [MethodName in string]: Function
}

type ClientArgs = {
  client: ClientArg
}

export type ClientArg = {
  [MethodName in string]: Function
}

type QueryOptionsCbArgs = {
  model?: string
  operation: string
  args: JsArgs | RawQueryArgs
  query: (args: JsArgs | RawQueryArgs) => Promise<unknown>
}

type ModelQueryOptionsCbArgs = {
  model: string
  operation: string
  args: JsArgs
  query: (args: JsArgs) => Promise<unknown>
}

type BatchQuery = {
  model: string | undefined
  operation: string
  args: JsArgs | RawQueryArgs
}

type BatchArgs = {
  queries: BatchQuery[]
  transaction?: { isolationLevel?: IsolationLevel }
}

export type BatchInternalParams = {
  requests: RequestParams[]
  customDataProxyFetch?: CustomDataProxyFetch
}

export type CustomDataProxyFetch = (fetch: Fetch) => Fetch

type BatchQueryOptionsCbArgs = {
  args: BatchArgs
  // TODO: hide internalParams before making batch api public
  query: (args: BatchArgs, __internalParams?: BatchInternalParams) => Promise<unknown[]>
  __internalParams: BatchInternalParams
}

export type QueryOptionsCb = (args: QueryOptionsCbArgs) => Promise<any>
export type ModelQueryOptionsCb = (args: ModelQueryOptionsCbArgs) => Promise<any>
export type BatchQueryOptionsCb = (args: BatchQueryOptionsCbArgs) => Promise<any>

type QueryOptions = {
  query: {
    [ModelName in string]:
      | {
          [ModelAction in string]: ModelQueryOptionsCb
        }
      | QueryOptionsCb // for all queries (eg. raw queries)
  }
}

export type QueryOptionsPrivate = QueryOptions & {
  query?: {
    $__internalBatch?: BatchQueryOptionsCb
  }
}

/**
 * TODO
 * @param this
 */
export function $extends(this: Client, extension: Args | ((client: Client) => Client)): Client {
  if (typeof extension === 'function') {
    return extension(this)
  }

  // re-apply models to the extend client: they always capture specific instance
  // of the client and without re-application they would not see new extensions
  const oldClient = unApplyModelsAndClientExtensions(this)
  const newClient = Object.create(oldClient, {
    _extensions: {
      value: this._extensions.append(extension),
    },
    $use: { value: undefined },
    $on: { value: undefined },
  }) as Client

  return applyModelsAndClientExtensions(newClient)
}

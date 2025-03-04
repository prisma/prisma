import type { RequestParams } from '../../../RequestHandler'
import type { CustomDataProxyFetch } from '../../engines'
import type { IsolationLevel } from '../../engines/common/types/Transaction'
import type { QueryOptions } from '../exported/ExtensionArgs'
import type { JsArgs } from '../exported/JsApi'
import type { RawQueryArgs } from '../exported/RawQueryArgs'

export type BatchQueryOptionsCbArgs = {
  args: BatchArgs
  // TODO: hide internalParams before making batch api public
  query: (args: BatchArgs, __internalParams?: BatchInternalParams) => Promise<unknown[]>
  __internalParams: BatchInternalParams
}

export type BatchQuery = {
  model: string | undefined
  operation: string
  args: JsArgs | RawQueryArgs
}

export type BatchArgs = {
  queries: BatchQuery[]
  transaction?: { isolationLevel?: IsolationLevel }
}

export type BatchInternalParams = {
  requests: RequestParams[]
  customDataProxyFetch?: CustomDataProxyFetch
}

export type BatchQueryOptionsCb = (args: BatchQueryOptionsCbArgs) => Promise<any>

export type QueryOptionsPrivate = QueryOptions & {
  query?: {
    $__internalBatch?: BatchQueryOptionsCb
  }
}

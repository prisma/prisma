import { RequestParams } from '../../../RequestHandler'
import { CustomDataProxyFetch } from '../../engines'
import { IsolationLevel } from '../../engines/common/types/Transaction'
import { QueryOptions } from '../exported/ExtensionArgs'
import { JsArgs } from '../exported/JsApi'
import { RawQueryArgs } from '../exported/RawQueryArgs'

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

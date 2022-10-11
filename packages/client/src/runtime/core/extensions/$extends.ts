import { actionOperationMap, Client } from '../../getPrismaClient'

export type Extension = {
  type: string
} & ResultOptions &
  ModelOptions &
  ClientOptions &
  QueryOptions

type ResultOptionsNeeds = {
  [K in string]: boolean | ResultOptionsNeeds
}

type ResultOptions = {
  result?: {
    needs: ResultOptionsNeeds
    fields: {
      [K in string]: () => unknown
    }
  }
}

type ModelOptions = {
  model?: {
    [K in string]: () => unknown
  }
}

type ClientOptions = {
  client?: {
    [K in string]: () => unknown
  }
}

type QueryOptionsCbArgs = {
  model: string
  operation: string
  args: { [K in string]: {} | undefined | null | QueryOptionsCbArgs['args'] }
  data: Promise<unknown>
}

type QueryOptionsCbArgsNested = QueryOptionsCbArgs & {
  path: string
}

type QueryOptions = {
  query?: {
    [key in keyof typeof actionOperationMap]: (args: QueryOptionsCbArgs) => unknown
  } & {
    nested?: {
      [K in string]: (args: QueryOptionsCbArgsNested) => unknown
    }
  }
}

/**
 * TODO
 * @param this
 */
export function $extends(this: Client, extension: Extension | (() => Extension)): Client {
  return Object.create(this, {
    _extensions: {
      get: () => {
        if (typeof extension === 'function') {
          return this._extensions.concat(extension())
        }

        return this._extensions.concat(extension)
      },
    },
  })
}

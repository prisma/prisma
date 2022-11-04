import { PrismaClientValidationError } from '../..'
import { Client } from '../../getPrismaClient'
import { HIDDEN_CLIENT, HIDDEN_MODEL } from '../types/Extensions'

export type Args = ResultArgs & ModelArgs & ClientArgs & QueryOptions

type ResultArgs = {
  result?: {
    [ModelName in string]: {
      needs: {
        [VirtPropName in string]: {
          [ModelPropName in string]: boolean
        }
      }
      fields: {
        [VirtPropName in string]: (data: any) => unknown
      }
    }
  }
}

type ModelArgs = {
  model?: {
    [ModelName in string]: {
      [MethodName in string]: (...args: any) => unknown
    } & {
      [K in typeof HIDDEN_MODEL]?: unknown
    }
  }
}

type ClientArgs = {
  client?: {
    [MethodName in string]: (...args: any) => unknown
  } & {
    [K in typeof HIDDEN_CLIENT]?: unknown
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
    [ModelName in string]:
      | {
          [ModelAction in string]: (args: QueryOptionsCbArgs) => Promise<any>
        } & {
          // $nestedOperations?: {
          //   [K in string]: (args: QueryOptionsCbArgsNested) => unknown
          // }
        }
  }
}

/**
 * TODO
 * @param this
 */
export function $extends(this: Client, extension: Args | (() => Args)): Client {
  // this preview flag is hidden until implementation is ready for preview release
  if (!this._hasPreviewFlag('clientExtensions')) {
    // TODO: when we are ready for preview release, change error message to
    // ask users to enable 'clientExtensions' preview feature
    throw new PrismaClientValidationError('Extensions are not yet available')
  }
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

import { Client } from '../../getPrismaClient'
import { PrismaClientValidationError } from '../../query'
import {
  applyModelsAndClientExtensions,
  unapplyModelsAndClientExtensions,
} from '../model/applyModelsAndClientExtensions'
import { OptionalFlat } from '../types/Utils'

export type Args = OptionalFlat<RequiredArgs>
export type RequiredArgs = ResultArgs & ModelArgs & ClientArgs & QueryOptions

type ResultArgs = {
  result: {
    [ModelName in string]: ResultModelArgs
  }
}

export type ResultArgsFieldCompute = (model: any) => unknown

export type ResultModelArgs = {
  [FieldName in string]: ResultFieldDefinition
}

export type ResultFieldDefinition = {
  needs?: { [FieldName in string]: boolean }
  compute: ResultArgsFieldCompute
}

type ModelArgs = {
  model: {
    [ModelName in string]: {
      [MethodName in string]: unknown
    }
  }
}

type ClientArgs = {
  client: {
    [MethodName in `$${string}`]: unknown
  }
}

type QueryOptionsCbArgs = {
  model?: string
  operation: string
  args: object
  query: (args: object) => Promise<unknown>
}

type QueryOptionsCbArgsNested = QueryOptionsCbArgs & {
  path: string
}

type QueryOptions = {
  query: {
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
export function $extends(this: Client, extension: Args | ((client: Client) => Args)): Client {
  // this preview flag is hidden until implementation is ready for preview release
  if (!this._hasPreviewFlag('clientExtensions')) {
    // TODO: when we are ready for preview release, change error message to
    // ask users to enable 'clientExtensions' preview feature
    throw new PrismaClientValidationError(
      'Extensions are not yet generally available, please add `clientExtensions` to the `previewFeatures` field in the `generator` block in the `schema.prisma` file.',
    )
  }
  // we need to re-apply models to the extend client:
  // they always capture specific instance of the client and without
  // re-application would never see new extensions
  const oldClient = unapplyModelsAndClientExtensions(this)
  const newClient = Object.create(oldClient, {
    _extensions: {
      get: () => {
        if (typeof extension === 'function') {
          return this._extensions.concat(extension(oldClient))
        }

        return this._extensions.concat(extension)
      },
    },
  })
  return applyModelsAndClientExtensions(newClient)
}

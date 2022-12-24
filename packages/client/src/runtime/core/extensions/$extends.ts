import { Client } from '../../getPrismaClient'
import { PrismaClientValidationError } from '../../query'
import {
  applyModelsAndClientExtensions,
  unapplyModelsAndClientExtensions,
} from '../model/applyModelsAndClientExtensions'
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

type ModelArgs = {
  model: {
    [ModelName in string]: ModelArg
  }
}

export type ModelArg = {
  [MethodName in string]: (...args: any[]) => any
}

type ClientArgs = {
  client: ClientArg
}

export type ClientArg = {
  [MethodName in string]: (...args: any[]) => any
}

type QueryOptionsCbArgs = {
  model?: string
  operation: string
  args: object
  query: (args: object) => Promise<unknown>
}

export type QueryOptionsCb = (args: QueryOptionsCbArgs) => Promise<any>

type QueryOptionsCbArgsNested = QueryOptionsCbArgs & {
  path: string
}

type QueryOptions = {
  query: {
    [ModelName in string]:
      | {
          [ModelAction in string]: QueryOptionsCb
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
export function $extends(this: Client, extension: Args | ((client: Client) => Client)): Client {
  if (!this._hasPreviewFlag('clientExtensions')) {
    throw new PrismaClientValidationError(
      'Extensions are not yet generally available, please add `clientExtensions` to the `previewFeatures` field in the `generator` block in the `schema.prisma` file.',
    )
  }

  if (typeof extension === 'function') {
    return extension(this)
  }

  // re-apply models to the extend client: they always capture specific instance
  // of the client and without re-application they would not see new extensions
  const oldClient = unapplyModelsAndClientExtensions(this)
  const newClient = Object.create(oldClient, {
    _extensions: {
      value: this._extensions.append(extension),
    },
  })

  return applyModelsAndClientExtensions(newClient)
}

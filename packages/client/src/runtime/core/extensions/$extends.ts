import { Client } from '../../getPrismaClient'
import { PrismaClientValidationError } from '../../query'
import {
  applyModelsAndClientExtensions,
  unapplyModelsAndClientExtensions,
} from '../model/applyModelsAndClientExtensions'
import { RawQueryArgs } from '../raw-query/RawQueryArgs'
import { JsArgs } from '../types/JsApi'
import { OptionalFlat } from '../types/Utils'

export type Args = OptionalFlat<RequiredArgs>
export type RequiredArgs = NameArgs & ResultArgs & ModelArgs & ClientArgs & QueryOptions

export type NameArgs = {
  name?: string
}

export type ResultArgs = {
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

export type ClientArgs = {
  client: ClientArg
}

export type ClientArg = {
  [MethodName in string]: Function
}

export type TopQueryOptionsCbArgs = {
  model?: string
  operation: string
  args: JsArgs | RawQueryArgs
  query: (args: JsArgs | RawQueryArgs) => Promise<unknown>
}

export type ModelQueryOptionsCbArgs = {
  model: string
  operation: string
  args: JsArgs
  query: (args: JsArgs) => Promise<unknown>
}

export type QueryOptionsCb = (args: TopQueryOptionsCbArgs) => Promise<any>
export type ModelQueryOptionsCb = (args: ModelQueryOptionsCbArgs) => Promise<any>

export type QueryOptions = {
  query: {
    [ModelName in string]:
      | {
          [ModelAction in string]: ModelQueryOptionsCb
        }
      | QueryOptionsCb // for "other" queries (eg. raw queries)
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

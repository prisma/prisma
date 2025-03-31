import type { FileMap } from '../../generateClient'
import { GenerateContext } from '../GenerateContext'

export function createModelsFile(context: GenerateContext, modelsFileMap: FileMap): string {
  return `
import * as runtime from '${context.runtimeJsPath}'

export import JsonObject = runtime.JsonObject
export import JsonArray = runtime.JsonArray
export import JsonValue = runtime.JsonValue
export import InputJsonObject = runtime.InputJsonObject
export import InputJsonArray = runtime.InputJsonArray
export import InputJsonValue = runtime.InputJsonValue

${Object.keys(modelsFileMap)
  .map((m) => `export type * from './models/${m}'`)
  .join('\n')}
`
}

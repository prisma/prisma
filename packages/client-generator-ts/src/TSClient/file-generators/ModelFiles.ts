import type { FileMap } from '../../generateClient'
import { GenerateContext } from '../GenerateContext'
import { Model } from '../Model'

export function createModelFiles(context: GenerateContext): FileMap {
  const importStatements = `import * as runtime from '${context.nestedRuntimeJsPath}';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result
import Decimal = runtime.Decimal
import DecimalJsLike = runtime.DecimalJsLike
import JsonObject = runtime.JsonObject
import JsonArray = runtime.JsonArray
import JsonValue = runtime.JsonValue
import InputJsonObject = runtime.InputJsonObject
import InputJsonArray = runtime.InputJsonArray
import InputJsonValue = runtime.InputJsonValue

${context.dmmf.datamodel.enums.length > 0 ? `import type * as $Enums from '../enums'` : ''}

import type * as Prisma from '../common'`

  const modelAndTypes = Object.values(context.dmmf.typeAndModelMap)
    .filter((modelOrType) => context.dmmf.outputTypeMap.model[modelOrType.name])
    .map((modelOrType) => new Model(modelOrType, context))

  const modelsFileMap: FileMap = {}
  modelAndTypes.forEach((m) => {
    return (modelsFileMap[m.fileName()] = `
${importStatements}

${m.toTS()}
`)
  })

  return modelsFileMap
}

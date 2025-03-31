import type { FileMap } from '../../generateClient'
import { GenerateContext } from '../GenerateContext'
import { Model } from '../Model'

export function createModelFiles(context: GenerateContext): FileMap {
  const modelAndTypes = Object.values(context.dmmf.typeAndModelMap)
    .filter((modelOrType) => context.dmmf.outputTypeMap.model[modelOrType.name])
    .map((modelOrType) => new Model(modelOrType, context))

  const modelsFileMap: FileMap = {}
  modelAndTypes.forEach((m) => {
    return (modelsFileMap[m.fileName()] = `
import type * as runtime from '@prisma/client/runtime/library';
${context.dmmf.datamodel.enums.length > 0 ? `import type * as $Enums from '../enums';` : ''}
import type * as Prisma from '../common';
 
${m.toTS()}
`)
  })

  return modelsFileMap
}

import * as ts from '@prisma/ts-builders'

import { GenerateContext } from './GenerateContext'

export function modelExports(context: GenerateContext): string[] {
  return Object.values(context.dmmf.typeAndModelMap)
    .filter((model) => context.dmmf.outputTypeMap.model[model.name])
    .map((model) => {
      const docLines = model.documentation ?? ''
      const modelLine = `Model ${model.name}\n`
      const docs = `${modelLine}${docLines}`

      const modelTypeExport = ts
        .moduleExport(ts.typeDeclaration(model.name, ts.namedType(`Prisma.${model.name}Model`)))
        .setDocComment(ts.docComment(docs))

      return ts.stringify(modelTypeExport)
    })
}

import * as ts from '@prisma/ts-builders'

import { GenerateContext } from '../GenerateContext'
import { InputType } from '../Input'

const jsDocHeader = `/**
 * This file exports various common sort, input & filter types that are not directly linked to a particular model.
 *
 * 🟢 You can import this file directly.
 */
`

export function createCommonInputTypeFiles(context: GenerateContext) {
  const imports = [
    ts.moduleImport(context.runtimeImport).asNamespace('runtime'),
    ts.moduleImport(context.importFileName(`./enums`)).asNamespace('$Enums'),
    ts.moduleImport(context.importFileName(`./internal/prismaNamespace`)).asNamespace('Prisma').typeOnly(),
  ].map((i) => ts.stringify(i))

  const genericInputTypes = context.dmmf.inputObjectTypes.prisma
    // Only contains generic input types that are not directly linked to a particular model
    .filter((i) => !i.meta?.grouping)
    .map((inputType) => {
      if (inputType.name.includes('Json') && inputType.name.includes('Filter')) {
        const needsGeneric = context.genericArgsInfo.typeNeedsGenericModelArg(inputType)
        const innerName = needsGeneric ? `${inputType.name}Base<$PrismaModel>` : `${inputType.name}Base`
        const typeName = needsGeneric ? `${inputType.name}<$PrismaModel = never>` : inputType.name
        // This generates types for JsonFilter to prevent the usage of 'path' without another parameter
        const baseName = `Required<${innerName}>`
        return `export type ${typeName} = 
| Prisma.PatchUndefined<
    Prisma.Either<${baseName}, Exclude<keyof ${baseName}, 'path'>>,
    ${baseName}
  >
| Prisma.OptionalFlat<Omit<${baseName}, 'path'>>
${new InputType(inputType, context).overrideName(`${inputType.name}Base`).toTS()}`
      } else {
        return new InputType(inputType, context).toTS()
      }
    })

  return `${jsDocHeader}
${imports.join('\n')}

${genericInputTypes.join('\n')}

${context.dmmf.inputObjectTypes.model?.map((inputType) => new InputType(inputType, context).toTS()).join('\n') ?? ''}
`
}

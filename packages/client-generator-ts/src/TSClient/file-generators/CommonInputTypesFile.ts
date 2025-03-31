import { GenerateContext } from '../GenerateContext'
import { InputType } from '../Input'

export function createCommonInputTypeFiles(context: GenerateContext) {
  return `
import type * as runtime from '@prisma/client/runtime/library';
${context.dmmf.datamodel.enums.length > 0 ? `import type * as $Enums from './enums';` : ''}
import type * as Prisma from './common';

  ${context.dmmf.inputObjectTypes.prisma
    ?.reduce((acc, inputType) => {
      // Only contains generic input types that are not directly linked to a particular model
      if (inputType.meta?.grouping) return acc

      if (inputType.name.includes('Json') && inputType.name.includes('Filter')) {
        const needsGeneric = context.genericArgsInfo.typeNeedsGenericModelArg(inputType)
        const innerName = needsGeneric ? `${inputType.name}Base<$PrismaModel>` : `${inputType.name}Base`
        const typeName = needsGeneric ? `${inputType.name}<$PrismaModel = never>` : inputType.name
        // This generates types for JsonFilter to prevent the usage of 'path' without another parameter
        const baseName = `Required<${innerName}>`
        acc.push(`export type ${typeName} = 
| Prisma.PatchUndefined<
    Prisma.Either<${baseName}, Exclude<keyof ${baseName}, 'path'>>,
    ${baseName}
  >
| Prisma.OptionalFlat<Omit<${baseName}, 'path'>>`)
        acc.push(new InputType(inputType, context).overrideName(`${inputType.name}Base`).toTS())
      } else {
        acc.push(new InputType(inputType, context).toTS())
      }
      return acc
    }, [] as string[])
    .join('\n')}

  ${context.dmmf.inputObjectTypes.model?.map((inputType) => new InputType(inputType, context).toTS()).join('\n') ?? ''}
  `
}

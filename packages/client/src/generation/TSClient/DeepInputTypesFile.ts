import { GenerateContext } from './GenerateContext'
import { InputType } from './Input'

export function createDeepInputTypesFile(context: GenerateContext): string {
  return `
import * as runtime from '${context.nestedRuntimeJsPath}';
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

import type * as $Enums from '../enums'
import type * as Prisma from '../common';
    
    ${context.dmmf.inputObjectTypes.prisma
      ?.reduce((acc, inputType) => {
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
    `
}

import { commonCodeTS } from './common'
import { Enum } from './Enum'
import { FieldRefInput } from './FieldRefInput'
import { GenerateContext } from './GenerateContext'
import { InputType } from './Input'
import { PrismaClientClass } from './PrismaClient'
import type { TSClientOptions } from './TSClient'

export function createCommonFile(context: GenerateContext, options: TSClientOptions): string {
  const prismaClientClass = new PrismaClientClass(
    context,
    options.datasources,
    options.outputDir,
    options.runtimeNameTs,
    options.browser,
  )

  const commonCode = commonCodeTS(options)

  const prismaEnums = context.dmmf.schema.enumTypes.prisma?.map((type) => new Enum(type, true).toTS())

  const fieldRefs = context.dmmf.schema.fieldRefTypes.prisma?.map((type) => new FieldRefInput(type).toTS()) ?? []

  return `
import * as runtime from '${context.runtimeJsPath}';
import $Types = runtime.Types // general types
import $Public = runtime.Types.Public
import $Utils = runtime.Types.Utils
import $Extensions = runtime.Types.Extensions
import $Result = runtime.Types.Result

import type * as Prisma from './models';
import type { PrismaClient } from './client';

export type * from './models';
    
${commonCode.ts()}
${new Enum(
  {
    name: 'ModelName',
    values: context.dmmf.mappings.modelOperations.map((m) => m.model),
  },
  true,
).toTS()}

${prismaClientClass.toTS()}
export type Datasource = {
  url?: string
}

/**
 * Enums
 */

${prismaEnums?.join('\n\n')}

${
  fieldRefs.length > 0
    ? `
/**
 * Field references 
 */

${fieldRefs.join('\n\n')}`
    : ''
}
/**
 * Deep Input Types
 */

${context.dmmf.inputObjectTypes.model?.map((inputType) => new InputType(inputType, context).toTS()).join('\n') ?? ''}

/**
 * Batch Payload for updateMany & deleteMany & createMany
 */

export type BatchPayload = {
  count: number
}

/**
 * DMMF
 */
export const dmmf: runtime.BaseDMMF
`
}

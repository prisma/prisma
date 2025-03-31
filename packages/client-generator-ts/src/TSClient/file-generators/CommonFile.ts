import { commonCodeTS } from '../common'
import { Enum } from '../Enum'
import { FieldRefInput } from '../FieldRefInput'
import { GenerateContext } from '../GenerateContext'
import { PrismaClientClass } from '../PrismaClient'
import type { TSClientOptions } from '../TSClient'

export function createCommonFile(context: GenerateContext, options: TSClientOptions): string {
  const prismaClientClass = new PrismaClientClass(context, options.datasources, options.outputDir, options.runtimeName)

  const commonCode = commonCodeTS(options)

  const prismaEnums = context.dmmf.schema.enumTypes.prisma?.map((type) => new Enum(type, true).toTS())

  const fieldRefs = context.dmmf.schema.fieldRefTypes.prisma?.map((type) => new FieldRefInput(type).toTS()) ?? []

  return `
import * as runtime from '@prisma/client/runtime/library';
import type * as Prisma from './models';
import type { PrismaClient } from './client';

export type * from './commonInputTypes';
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
 * Batch Payload for updateMany & deleteMany & createMany
 */

export type BatchPayload = {
  count: number
}
`
}

import { GenerateContext } from '../GenerateContext'
import { PrismaClientClass } from '../PrismaClient'
import { TSClientOptions } from '../TSClient'

export function createClassFile(context: GenerateContext, options: TSClientOptions): string {
  const prismaClientClass = new PrismaClientClass(
    context,
    options.datasources,
    options.outputDir,
    options.runtimeNameTs,
    options.browser,
  )

  return `
import type * as $Runtime from '@prisma/client/runtime/library';
import type * as Prisma from './common';
  
${prismaClientClass.toTSWithoutNamespace()}
`
}

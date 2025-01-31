import { GenerateContext } from './GenerateContext'
import { PrismaClientClass } from './PrismaClient'
import { TSClientOptions } from './TSClient'

export function createClientFile(context: GenerateContext, options: TSClientOptions): string {
  const prismaClientClass = new PrismaClientClass(
    context,
    options.datasources,
    options.outputDir,
    options.runtimeNameTs,
    options.browser,
  )

  return prismaClientClass.toTSWithoutNamespace()
}

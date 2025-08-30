import { getClientEngineType } from '@prisma/internals'

import { GenerateContext } from '../GenerateContext'
import { modelExports } from '../ModelExports'
import { TSClientOptions } from '../TSClient'

const jsDocHeader = `/*
 * This file should be your main import to use Prisma related types and utilities in the browser. 
 * Through it you get access to all the models, enums, and input types.
 * 
 * This file however does not contain a PrismaClient class as well as various other helpers that shall only be used in the backend. 
 * See client.ts for the backend entry point.
 *
 * 🟢 You can import this file directly.
 */
`

export function createBrowserFile(context: GenerateContext, options: TSClientOptions): string {
  const clientEngineType = getClientEngineType(options.generator)
  options.generator.config.engineType = clientEngineType

  return `${jsDocHeader}
import * as Prisma from '${context.importFileName('./internal/prismaNamespaceBrowser')}'

export { Prisma }
export * as $Enums from '${context.importFileName('./enums')}'
export * from '${context.importFileName('./enums')}';

${modelExports(context).join('\n')}
`
}

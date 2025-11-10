import { PrismaConfigInternal } from '@prisma/config'
import { green } from 'kleur/colors'

import { link } from '..'

/**
 * Get the message to display when a command is forbidden with a data proxy flag
 * @param command the cli command (eg. db push)
 * @returns
 */
export const forbiddenCmdWithDataProxyFlagMessage = (command: string) => `
Using an Accelerate URL is not supported for this CLI command ${green(`prisma ${command}`)} yet.
Please use a direct connection to your database in \`prisma.config.ts\`.

More information about this limitation: ${link('https://pris.ly/d/accelerate-limitations')}
`

/**
 * Check that the data proxy cannot be used through the given urls and schema contexts
 * @param command the cli command (eg. db push)
 * @param urls list of urls to check
 * @param schemaContexts list of schema contexts to check
 */
export function checkUnsupportedDataProxy({ cmd, config }: { cmd: string; config?: PrismaConfigInternal }) {
  if (config?.datasource?.url.startsWith('prisma://')) {
    throw new Error(forbiddenCmdWithDataProxyFlagMessage(cmd))
  }
}

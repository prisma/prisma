import { green } from 'kleur/colors'

import { link } from '..'
import type { PrismaConfigWithDatasource } from '../utils/validatePrismaConfigWithDatasource'

/**
 * Get the message to display when a command is forbidden with a data proxy flag
 * @param cmd the cli command (eg. db push)
 * @returns
 */
export const forbiddenCmdWithDataProxyFlagMessage = (cmd: string) => `
Using an Accelerate URL is not supported for this CLI command ${green(`prisma ${cmd}`)} yet.
Please use a direct connection to your database in \`prisma.config.ts\`.

More information about this limitation: ${link('https://pris.ly/d/accelerate-limitations')}
`

/**
 * Check that the data proxy cannot be used through the given urls and schema contexts
 * @param cmd the cli command (eg. db push)
 * @param validatedConfig the validated Prisma Config value
 */
export function checkUnsupportedDataProxy({
  cmd,
  validatedConfig,
}: {
  cmd: string
  validatedConfig: PrismaConfigWithDatasource
}) {
  if (validatedConfig.datasource.url.startsWith('prisma://')) {
    throw new Error(forbiddenCmdWithDataProxyFlagMessage(cmd))
  }
}

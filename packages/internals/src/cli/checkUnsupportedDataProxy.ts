import { green } from 'kleur/colors'

import { getEffectiveUrl, link, SchemaContext } from '..'
import { resolveUrl } from '../engine-commands/getConfig'

/**
 * Get the message to display when a command is forbidden with a data proxy flag
 * @param command the cli command (eg. db push)
 * @returns
 */
export const forbiddenCmdWithDataProxyFlagMessage = (command: string) => `
Using an Accelerate URL is not supported for this CLI command ${green(`prisma ${command}`)} yet.
Please use a direct connection to your database via the datasource \`directUrl\` setting.

More information about this limitation: ${link('https://pris.ly/d/accelerate-limitations')}
`

/**
 * Check that the data proxy cannot be used through the given urls and schema contexts
 * @param command the cli command (eg. db push)
 * @param urls list of urls to check
 * @param schemaContexts list of schema contexts to check
 */
export function checkUnsupportedDataProxy({
  cmd,
  schemaContext = undefined,
  urls = [],
}: {
  cmd: string
  schemaContext?: SchemaContext
  urls?: (string | undefined)[]
}) {
  for (const url of urls) {
    if (url && url.includes('prisma://')) {
      throw new Error(forbiddenCmdWithDataProxyFlagMessage(cmd))
    }
  }

  if (!schemaContext?.primaryDatasource) return

  const url = resolveUrl(getEffectiveUrl(schemaContext.primaryDatasource))

  if (url?.startsWith('prisma://')) {
    throw new Error(forbiddenCmdWithDataProxyFlagMessage(cmd))
  }
}

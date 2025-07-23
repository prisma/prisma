import { PrismaConfigInternal } from '@vetching-corporation/prisma-config'
import { green } from 'kleur/colors'

import { link } from '..'

/**
 * Get the message to display when a command is forbidden with a data proxy flag
 * @param command the cli command (eg. db push)
 * @returns
 */
export const forbiddenCmdFlagWithSchemaEngineWasm = ({ cmd, flag }: { cmd: string; flag: string }) => `
Passing the ${green(`${flag}`)} flag to the ${green(`prisma ${cmd}`)} command is not supported when
defining a ${green(`migrate.adapter`)} in ${green(`prisma.config.ts`)}.

More information about this limitation: ${link('https://pris.ly/d/schema-engine-limitations')}
`

/**
 * Check that the data proxy cannot be used through the given urls and schema contexts
 * @param command the cli command (eg. db push)
 * @param urls list of urls to check
 * @param schemaContexts list of schema contexts to check
 */
export function checkUnsupportedSchemaEngineWasm({
  cmd,
  config,
  args,
  flags,
}: {
  cmd: string
  config: PrismaConfigInternal
  args: Record<string, unknown>
  flags: Array<string>
}) {
  if (!config.adapter) {
    return
  }

  for (const flag of flags) {
    if (args[flag] !== undefined) {
      throw new Error(forbiddenCmdFlagWithSchemaEngineWasm({ cmd, flag }))
    }
  }
}

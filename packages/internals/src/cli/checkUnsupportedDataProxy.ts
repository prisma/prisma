import { defaultTestConfig } from '@prisma/config'
import fs from 'node:fs'
import { green } from 'kleur/colors'
import type { O } from 'ts-toolbelt'

import { getConfig, getEffectiveUrl, getSchemaWithPath, link } from '..'
import { resolveUrl } from '../engine-commands/getConfig'
import { loadEnvFile } from '../utils/loadEnvFile'
import type { SchemaPathFromConfig } from './getSchema'

/**
 * These are the cli args that we check the data proxy for. If in use
 */
const checkedArgs = {
  // Directly contain connection string
  '--url': true,
  '--to-url': true,
  '--from-url': true,
  '--shadow-database-url': true,
  // Contain path to schema file with connection string (directly or via env var)
  '--schema': true,
  '--from-schema-datamodel': true,
  '--to-schema-datamodel': true,
}

type Args = O.Optional<O.Update<typeof checkedArgs, any, string>>

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
 * Check that the data proxy cannot be used through the given args
 * @param command the cli command (eg. db push)
 * @param args the cli command arguments
 * @param schemaPathFromConfig schema path config from prisma.config.ts
 * @param implicitSchema if this command implicitly loads a schema
 */
async function checkUnsupportedDataProxyMessage(
  command: string,
  args: Args,
  schemaPathFromConfig: SchemaPathFromConfig | undefined,
  implicitSchema: boolean,
) {
  // when the schema can be implicit, we use its default location
  if (implicitSchema === true) {
    // TODO: Why do we perform this mutation?
    args['--schema'] = (await getSchemaWithPath(args['--schema'], schemaPathFromConfig))?.schemaPath ?? undefined
  }

  const argList = Object.entries(args)
  for (const [argName, argValue] of argList) {
    // for all the args that represent an url ensure data proxy isn't used
    if (argName.includes('url') && argValue.includes('prisma://')) {
      return forbiddenCmdWithDataProxyFlagMessage(command)
    }

    // for all the args that represent a schema path (including implicit, default path) ensure data proxy isn't used
    if (argName.includes('schema')) {
      await loadEnvFile({ schemaPath: argValue, printMessage: false, config: defaultTestConfig() })

      const datamodel = await fs.promises.readFile(argValue, 'utf-8')
      const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
      const url = resolveUrl(getEffectiveUrl(config.datasources[0]))

      if (url?.startsWith('prisma://')) {
        return forbiddenCmdWithDataProxyFlagMessage(command)
      }
    }
  }

  return undefined
}

export async function checkUnsupportedDataProxy(
  command: string,
  args: Args,
  schemaPathFromConfig: SchemaPathFromConfig | undefined,
  implicitSchema: boolean,
) {
  const message = await checkUnsupportedDataProxyMessage(command, args, schemaPathFromConfig, implicitSchema).catch(
    () => undefined,
  )

  if (message) throw new Error(message)
}

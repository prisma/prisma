import chalk from 'chalk'
import fs from 'fs'
import { O } from 'ts-toolbelt'

import { getConfig, getSchemaPath, link } from '..'
import { loadEnvFile } from '../utils/loadEnvFile'

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
Using the Data Proxy (connection URL starting with protocol ${chalk.green(
  'prisma://',
)}) is not supported for this CLI command ${chalk.green(
  `prisma ${command}`,
)} yet. Please use a direct connection to your database for now.

More information about Data Proxy: ${link('https://pris.ly/d/data-proxy-cli')}
`

/**
 * Check that the data proxy cannot be used through the given args
 * @param command the cli command (eg. db push)
 * @param args the cli command arguments
 * @param implicitSchema if this command implicitly loads a schema
 */
async function _checkUnsupportedDataProxy(command: string, args: Args, implicitSchema: boolean) {
  // when the schema can be implicit, we use its default location
  if (implicitSchema === true) {
    args['--schema'] = (await getSchemaPath(args['--schema'])) ?? undefined
  }

  const argList = Object.entries(args)
  for (const [argName, argValue] of argList) {
    // for all the args that represent an url ensure data proxy isn't used
    if (argName.includes('url') && argValue.includes('prisma://')) {
      console.error(forbiddenCmdWithDataProxyFlagMessage(command))
      process.exit(1)
    }

    // for all the args that represent a schema path ensure data proxy isn't used
    if (argName.includes('schema')) {
      loadEnvFile(argValue, false)

      const datamodel = await fs.promises.readFile(argValue, 'utf-8')
      const config = await getConfig({ datamodel, ignoreEnvVarErrors: true })
      const urlFromValue = config.datasources[0]?.url.value
      const urlEnvVarName = config.datasources[0]?.url.fromEnvVar
      const urlEnvVarValue = urlEnvVarName ? process.env[urlEnvVarName] : undefined

      if ((urlFromValue ?? urlEnvVarValue)?.startsWith('prisma://')) {
        console.error(forbiddenCmdWithDataProxyFlagMessage(command))
        process.exit(1)
      }
    }
  }
}

export async function checkUnsupportedDataProxy(command: string, args: Args, implicitSchema: boolean) {
  try {
    await _checkUnsupportedDataProxy(command, args, implicitSchema)
  } catch (_) {}
}

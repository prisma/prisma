import Debug from '@prisma/debug'
import { getCLIPathHash, getConfig, getProjectHash, getSchema, parseEnvValue } from '@prisma/internals'
import type { Check } from 'checkpoint-client'
import * as checkpoint from 'checkpoint-client'

const debug = Debug('prisma:cli:checkpoint')

/**
 * Collect and prepare data then run the Checkpoint Client which will send some info to the remote Checkpoint Server
 * It will be done in a child process so the CLI won't have to wait for it to finish to exit
 *
 * returns if the current CLI version is outdated.
 *
 * For more info about the data collected by the Checkpoint Server and how to disable it see:
 * https://www.prisma.io/docs/concepts/more/telemetry
 */
export async function runCheckpointClientCheck({
  schemaPath,
  isPrismaInstalledGlobally,
  version,
  command,
  telemetryInformation,
}: {
  isPrismaInstalledGlobally: 'npm' | 'yarn' | false
  version: string
  command: string
  telemetryInformation: string
  schemaPath?: string
}): Promise<Check.Result | 0> {
  try {
    // SHA256 identifier for the project based on the Prisma schema path
    const projectPathHash = await getProjectHash()
    // SHA256 of the cli path
    const cliPathHash = getCLIPathHash()
    // Read schema and extract some data
    const { schemaProvider, schemaPreviewFeatures, schemaGeneratorsProviders } = await tryToReadDataFromSchema(
      schemaPath,
    )

    const data: Check.Input = {
      // Name of the product
      product: 'prisma',
      // Currently installed version of the CLI
      version,
      // A unique hash of the path in which the CLI is installed
      cli_path_hash: cliPathHash,
      // A unique hash of the project's path, i.e.. the `schema.prisma`'s path
      project_hash: projectPathHash,
      // The first datasource provider (e.g. postgresql)
      schema_providers: schemaProvider ? [schemaProvider] : undefined,
      // previewFeatures from the prisma-client-js generator
      schema_preview_features: schemaPreviewFeatures,
      // Generator providers (e.g. prisma-client-js)
      schema_generators_providers: schemaGeneratorsProviders,
      // Type of CLI install: global or local
      cli_install_type: isPrismaInstalledGlobally ? 'global' : 'local',
      // Command with redacted options
      command,
      // Internal: Additional information from `--telemetry-information` option or `PRISMA_TELEMETRY_INFORMATION` env var
      // Default: undefined
      information: telemetryInformation || process.env.PRISMA_TELEMETRY_INFORMATION,
      // Absolute CLI path
      // Note: This won't be sent to the checkpoint server.
      // TODO: Check if we can remove, probably not needed since cli_path_hash is defined
      cli_path: process.argv[1],
    }

    // Call Checkpoint Client and return result
    return await checkpoint.check(data)
  } catch (e) {
    debug('Error from runCheckpointClientCheck()')
    debug(e)
    return 0
  }
}

/*
 * Tries to read some data from the Prisma Schema
 * if an error occurs it will silently fail and return undefined values
 */
export async function tryToReadDataFromSchema(schemaPath?: string) {
  let schemaProvider: string | undefined
  let schemaPreviewFeatures: string[] | undefined
  let schemaGeneratorsProviders: string[] | undefined

  try {
    const schema = await getSchema(schemaPath)

    try {
      const config = await getConfig({
        datamodel: schema,
        ignoreEnvVarErrors: true,
      })

      if (config.datasources.length > 0) {
        schemaProvider = config.datasources[0].provider
      }

      // Example 'prisma-client-js'
      schemaGeneratorsProviders = config.generators
        // Check that value is defined
        .filter((generator) => generator && generator.provider)
        .map((generator) => parseEnvValue(generator.provider))

      // restrict the search to previewFeatures of `provider = 'prisma-client-js'`
      // (this was not scoped to `prisma-client-js` before Prisma 3.0)
      const prismaClientJSGenerator = config.generators.find(
        (generator) => parseEnvValue(generator.provider) === 'prisma-client-js',
      )
      if (prismaClientJSGenerator && prismaClientJSGenerator.previewFeatures.length > 0) {
        schemaPreviewFeatures = prismaClientJSGenerator.previewFeatures
      }
    } catch (e) {
      debug(
        'Error from tryToReadDataFromSchema() while processing the schema. This is not a fatal error. It will continue without the processed data.',
      )
      debug(e)
    }
  } catch (e) {
    // fail silently if schema can't be read
  }

  return {
    schemaProvider,
    schemaPreviewFeatures,
    schemaGeneratorsProviders,
  }
}

/*
 * String options of the CLI
 * Tip: search for `: String,`
 */
export const SENSITIVE_CLI_OPTIONS = [
  // 1. Connection strings
  '--url',
  '--shadow-database-url',
  '--from-url',
  '--to-url',
  // 2. Paths
  '--schema',
  '--file',
  '--from-schema-datamodel',
  '--to-schema-datamodel',
  '--from-schema-datasource',
  '--to-schema-datasource',
  '--from-migrations',
  '--to-migrations',
  '--hostname',
  // 3. Migration names
  '--name',
  '--applied',
  '--rolled-back',
]
/*
 * removes potentially sensitive information from the command array (argv strings)
 */
export const redactCommandArray = (commandArray: string[]): string[] => {
  const REDACTED_TAG = '[redacted]'

  for (let i = 0; i < commandArray.length; i++) {
    const arg = commandArray[i]
    // redact --option arguments
    SENSITIVE_CLI_OPTIONS.forEach((option: string) => {
      // --url file:./dev.db
      // arg is `--url` and a complete match
      const argIndexCompleteMatch = arg === option
      // --url=file:./dev.db
      // arg value is `--url=file:./dev.db` and a partial match
      const argIndexPartialMatch = arg.indexOf(option)

      // First check for complete match and redact the value
      if (argIndexCompleteMatch) {
        commandArray[i + 1] = REDACTED_TAG
      }
      // else check for partial match and redact the value
      else if (argIndexPartialMatch !== -1) {
        commandArray[i] = `${option}=${REDACTED_TAG}`
      }
    })
  }

  return commandArray
}

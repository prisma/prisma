import Debug from '@prisma/debug'
import {
  getCLIPathHash,
  getConfig,
  getProjectHash,
  getSchema,
  parseEnvValue,
  findNearestPackageJson,
} from '@prisma/internals'
import type { Check } from 'checkpoint-client'
import * as checkpoint from 'checkpoint-client'
import path from 'path'
import { valid as semverValid } from 'semver'

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
  // If the user has disabled telemetry, we can stop here already.
  if (process.env['CHECKPOINT_DISABLE']) {
    // TODO: this breaks checkpoint-client abstraction, ideally it would export a reusable isGloballyDisabled() function
    debug('runCheckpointClientCheck() is disabled by the CHECKPOINT_DISABLE env var.')
    return 0
  }

  try {
    const startGetInfo = performance.now()
    // Get some info about the project
    const [projectPathHash, { schemaProvider, schemaPreviewFeatures, schemaGeneratorsProviders }] = await Promise.all([
      // SHA256 identifier for the project based on the Prisma schema path
      getProjectHash(),
      // Read schema and extract some data
      tryToReadDataFromSchema(schemaPath),
    ])
    // SHA256 of the cli path
    const cliPathHash = getCLIPathHash()

    // Extract some data from the package.json
    // This only collects data from the nearest package.json
    // And the minimum required data to identify some frameworks
    const packageJsonData = await tryToExtractSomeDataFromPackageJson(schemaPath)

    const endGetInfo = performance.now()
    const getInfoElapsedTime = endGetInfo - startGetInfo
    debug(`runCheckpointClientCheck(): Execution time for getting info: ${getInfoElapsedTime} ms`)

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
      // Data extracted from the nearest package.json
      pkg_type: packageJsonData.type,
      typescript: packageJsonData.typescript,
    }

    const startCheckpoint = performance.now()
    // Call Checkpoint Client and return result
    const checkpointResult = await checkpoint.check(data)
    const endCheckpoint = performance.now()
    const checkpointElapsedTime = endCheckpoint - startCheckpoint
    debug(`runCheckpointClientCheck(): Execution time for "await checkpoint.check(data)": ${checkpointElapsedTime} ms`)

    return checkpointResult
  } catch (e) {
    debug('Error from runCheckpointClientCheck()--:', e)
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

export async function tryToExtractSomeDataFromPackageJson(cwd?: string) {
  const packageJson = await findNearestPackageJson(cwd)
  const packagePath = packageJson?.path
  let packageType: string | undefined = packageJson?.data.type || ''
  // If the value is not 'module' or 'commonjs' then it's invalid and we don't want to send it
  // https://nodejs.org/api/packages.html#type
  if (!['module', 'commonjs'].includes(packageType)) {
    packageType = undefined
  }

  const data = {
    typescript: undefined,
    type: packageType,
  }

  if (!packagePath) {
    return data
  }

  // Require typescript to get its version
  try {
    const requirePath = require.resolve('typescript/package.json', { paths: [path.basename(packagePath)] })
    const typescript = require(requirePath)
    // Check that the version is valid before collecting it
    if (typescript.version && semverValid(typescript.version)) {
      data.typescript = typescript.version
    }
  } catch (e) {
    debug('Error from tryToExtractSomeDataFromPackageJson()', e)
  }

  return data
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
  // 4. Platform CLI
  '--token',
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

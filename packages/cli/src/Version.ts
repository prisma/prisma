import type { PrismaConfigInternal } from '@prisma/config'
import { enginesVersion } from '@prisma/engines'
import { getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import {
  arg,
  BinaryType,
  Command,
  format,
  formatTable,
  getEnginesInfo,
  getTypescriptVersion,
  HelpError,
  isError,
  loadEnvFile,
  loadSchemaContext,
  resolveEngine,
  wasm,
} from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'
import os from 'os'
import { match } from 'ts-pattern'

import { getClientGeneratorInfo } from './utils/client'
import { getInstalledPrismaClientVersion } from './utils/getClientVersion'

const packageJson = require('../package.json')

/**
 * $ prisma version
 */
export class Version implements Command {
  static new(): Version {
    return new Version()
  }

  private static help = format(`
  Print current version of Prisma components

  ${bold('Usage')}

    ${dim('$')} prisma -v [options]
    ${dim('$')} prisma version [options]

  ${bold('Options')}

    -h, --help     Display this help message
        --json     Output JSON
`)

  async parse(argv: string[], config: PrismaConfigInternal): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--version': Boolean,
      '-v': '--version',
      '--config': String,
      '--json': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    await loadEnvFile({ printMessage: !args['--json'], config })

    const schemaPathFromArg = args['--schema']

    const { engineType } = await getClientGeneratorInfo({
      schemaPathFromConfig: config.schema,
      schemaPathFromArg,
    }).catch((_) => {
      const id = <const T>(x: T): T => x
      const engineType = match(process.env.PRISMA_CLI_QUERY_ENGINE_TYPE ?? process.env.PRISMA_QUERY_ENGINE_TYPE)
        .with('binary', id)
        .with('library', id)
        .otherwise(() => 'library' as const)

      return { engineType }
    })

    const { schemaEngineRows, schemaEngineRetrievalErrors } = await match(config.adapter)
      .with(undefined, async () => {
        const name = BinaryType.SchemaEngineBinary
        const engineResult = await resolveEngine(name)
        const [enginesInfo, enginesRetrievalErrors] = getEnginesInfo(engineResult)

        return {
          schemaEngineRows: [['Schema Engine', enginesInfo] as const],
          schemaEngineRetrievalErrors: enginesRetrievalErrors,
        }
      })
      .otherwise(async (adapterFn) => {
        const adapter = await adapterFn()
        const enginesRetrievalErrors = [] as Error[]

        return {
          schemaEngineRows: [
            ['Schema Engine', `@prisma/schema-engine-wasm ${wasm.schemaEngineWasmVersion}`] as const,
            ['Schema Engine Adapter', adapter.adapterName] as const,
          ],
          schemaEngineRetrievalErrors: enginesRetrievalErrors,
        }
      })

    const { queryEngineRows, queryEngineRetrievalErrors } = await match(engineType)
      // eslint-disable-next-line @typescript-eslint/require-await
      .with('client', async () => {
        const engineRetrievalErrors = [] as Error[]
        return {
          queryEngineRows: [['Query Compiler', 'enabled']],
          queryEngineRetrievalErrors: engineRetrievalErrors,
        }
      })
      .with('library', async () => {
        const name = BinaryType.QueryEngineLibrary
        const engineResult = await resolveEngine(name)
        const [enginesInfo, enginesRetrievalErrors] = getEnginesInfo(engineResult)

        return {
          queryEngineRows: [['Query Engine (Node-API)', enginesInfo] as const],
          queryEngineRetrievalErrors: enginesRetrievalErrors,
        }
      })
      .with('binary', async () => {
        const name = BinaryType.QueryEngineBinary
        const engineResult = await resolveEngine(name)
        const [enginesInfo, enginesRetrievalErrors] = getEnginesInfo(engineResult)

        return {
          queryEngineRows: [['Query Engine (Binary)', enginesInfo] as const],
          queryEngineRetrievalErrors: enginesRetrievalErrors,
        }
      })
      .exhaustive()

    const binaryTarget = await getBinaryTargetForCurrentPlatform()

    const prismaClientVersion = await getInstalledPrismaClientVersion()
    const typescriptVersion = await getTypescriptVersion()

    const rows = [
      [packageJson.name, packageJson.version],
      ['@prisma/client', prismaClientVersion ?? 'Not found'],
      ['Computed binaryTarget', binaryTarget],
      ['Operating System', os.platform()],
      ['Architecture', os.arch()],
      ['Node.js', process.version],
      ['TypeScript', typescriptVersion],
      ...queryEngineRows,
      ['PSL', `@prisma/prisma-schema-wasm ${wasm.prismaSchemaWasmVersion}`],
      ...schemaEngineRows,

      ['Default Engines Hash', enginesVersion],
      ['Studio', packageJson.devDependencies['@prisma/studio-server']],
    ]

    /**
     * If reading Rust engines metainfo (like their git hash) failed, display the errors to stderr,
     * and let Node.js exit naturally, but with error code 1.
     */

    const enginesMetaInfoErrors = [...queryEngineRetrievalErrors, ...schemaEngineRetrievalErrors]

    if (enginesMetaInfoErrors.length > 0) {
      process.exitCode = 1
      enginesMetaInfoErrors.forEach((e) => console.error(e))
    }

    const featureFlags = await this.getFeatureFlags(config.schema)
    if (featureFlags && featureFlags.length > 0) {
      rows.push(['Preview Features', featureFlags.join(', ')])
    }

    // @ts-ignore TODO @jkomyno, as affects the type of rows
    return formatTable(rows, { json: args['--json'] })
  }

  private async getFeatureFlags(schemaPath: string | undefined): Promise<string[]> {
    try {
      const { generators } = await loadSchemaContext({ schemaPathFromConfig: schemaPath })
      const generator = generators.find((g) => g.previewFeatures.length > 0)
      if (generator) {
        return generator.previewFeatures
      }
    } catch (e) {
      // console.error(e)
    }
    return []
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Version.help}`)
    }

    return Version.help
  }
}

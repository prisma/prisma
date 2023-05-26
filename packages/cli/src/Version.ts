import { enginesVersion, getCliQueryEngineBinaryType } from '@prisma/engines'
import { getPlatform } from '@prisma/get-platform'
import type { Command } from '@prisma/internals'
import {
  arg,
  BinaryType,
  format,
  formatTable,
  getConfig,
  getEnginesMetaInfo,
  getSchema,
  getSchemaPath,
  HelpError,
  isError,
  loadEnvFile,
  wasm,
} from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'
import { match, P } from 'ts-pattern'

import { getInstalledPrismaClientVersion } from './utils/getClientVersion'

const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

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

  async parse(argv: string[]): Promise<string | Error> {
    const args = arg(argv, {
      '--help': Boolean,
      '-h': '--help',
      '--version': Boolean,
      '-v': '--version',
      '--json': Boolean,
      '--telemetry-information': String,
    })

    if (isError(args)) {
      return this.help(args.message)
    }

    if (args['--help']) {
      return this.help()
    }

    loadEnvFile(undefined, true)

    const platform = await getPlatform()
    const cliQueryEngineBinaryType = getCliQueryEngineBinaryType()

    const [enginesMetaInfo, enginesMetaInfoErrors] = await getEnginesMetaInfo()

    const enginesRows = enginesMetaInfo.map((engineMetaInfo) => {
      return match(engineMetaInfo)
        .with({ 'query-engine': P.select(), 'migration-engine': P.select() }, (currEngineInfo) => {
          return [
            [
              `Query Engine${cliQueryEngineBinaryType === BinaryType.QueryEngineLibrary ? ' (Node-API)' : ' (Binary)'}`,
              currEngineInfo,
            ],
            ['Migration Engine', currEngineInfo],
          ]
        })
        .exhaustive()
    })

    const prismaClientVersion = await getInstalledPrismaClientVersion()

    const rows: string[][] = [
      [packageJson.name, packageJson.version],
      ['@prisma/client', prismaClientVersion ?? 'Not found'],
      ['Current platform', platform],

      ...enginesRows,
      ['Format Wasm', `@prisma/prisma-fmt-wasm ${wasm.prismaFmtVersion}`],

      ['Default Engines Hash', enginesVersion],
      ['Studio', packageJson.devDependencies['@prisma/studio-server']],
    ]

    /**
     * If reading Rust engines metainfo (like their git hash) failed, display the errors to stderr,
     * and let Node.js exit naturally, but with error code 1.
     */
    if (enginesMetaInfoErrors.length > 0) {
      process.exitCode = 1
      enginesMetaInfoErrors.forEach((e) => console.error(e))
    }

    const schemaPath = await getSchemaPath()
    const featureFlags = await this.getFeatureFlags(schemaPath)

    if (featureFlags && featureFlags.length > 0) {
      rows.push(['Preview Features', featureFlags.join(', ')])
    }

    return formatTable(rows, { json: args['--json'] })
  }

  private async getFeatureFlags(schemaPath: string | null): Promise<string[]> {
    if (!schemaPath) {
      return []
    }

    try {
      const datamodel = await getSchema()
      const config = await getConfig({
        datamodel,
        ignoreEnvVarErrors: true,
      })
      const generator = config.generators.find((g) => g.previewFeatures.length > 0)
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

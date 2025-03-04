import type { PrismaConfigInternal } from '@prisma/config'
import { enginesVersion, getCliQueryEngineBinaryType } from '@prisma/engines'
import { getBinaryTargetForCurrentPlatform } from '@prisma/get-platform'
import type { Command } from '@prisma/internals'
import {
  arg,
  BinaryType,
  format,
  formatTable,
  getConfig,
  getEnginesMetaInfo,
  getSchema,
  getSchemaWithPath,
  getTypescriptVersion,
  HelpError,
  isError,
  loadEnvFile,
  wasm,
} from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'
import os from 'node:os'
import { match, P } from 'ts-pattern'

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

    const binaryTarget = await getBinaryTargetForCurrentPlatform()
    const cliQueryEngineBinaryType = getCliQueryEngineBinaryType()

    const [enginesMetaInfo, enginesMetaInfoErrors] = await getEnginesMetaInfo()

    const enginesRows = enginesMetaInfo.map((engineMetaInfo) => {
      return (
        match(engineMetaInfo)
          .with({ 'query-engine': P.select() }, (currEngineInfo) => {
            return [
              `Query Engine${cliQueryEngineBinaryType === BinaryType.QueryEngineLibrary ? ' (Node-API)' : ' (Binary)'}`,
              currEngineInfo,
            ]
          })
          // @ts-ignore TODO @jkomyno, as affects the type of rows
          .with({ 'schema-engine': P.select() }, (currEngineInfo) => {
            return ['Schema Engine', currEngineInfo]
          })
          .exhaustive()
      )
    })

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

      ...enginesRows,
      ['Schema Wasm', `@prisma/prisma-schema-wasm ${wasm.prismaSchemaWasmVersion}`],

      ['Default Engines Hash', enginesVersion],
      ['Studio', packageJson.devDependencies['@prisma/studio-server']],
    ]

    /**
     * If reading Rust engines metainfo (like their git hash) failed, display the errors to stderr,
     * and let Node.js exit naturally, but with error code 1.
     */
    if (enginesMetaInfoErrors.length > 0) {
      process.exitCode = 1
      for (const e of enginesMetaInfoErrors) {
        console.error(e)
      }
    }

    let schemaPath: string | null = null
    try {
      schemaPath = (await getSchemaWithPath(undefined, config.schema)).schemaPath
    } catch {
      schemaPath = null
    }
    const featureFlags = await this.getFeatureFlags(schemaPath)
    if (featureFlags && featureFlags.length > 0) {
      rows.push(['Preview Features', featureFlags.join(', ')])
    }

    // @ts-ignore TODO @jkomyno, as affects the type of rows
    return formatTable(rows, { json: args['--json'] })
  }

  private async getFeatureFlags(schemaPath: string | null): Promise<string[]> {
    if (!schemaPath) {
      return []
    }

    try {
      const datamodel = await getSchema(schemaPath)
      const config = await getConfig({
        datamodel,
        ignoreEnvVarErrors: true,
      })
      const generator = config.generators.find((g) => g.previewFeatures.length > 0)
      if (generator) {
        return generator.previewFeatures
      }
    } catch (_e) {
      // console.error(e)
    }
    return []
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red('!'))} ${error}\n${Version.help}`)
    }

    return Version.help
  }
}

import { enginesVersion, getCliQueryEngineType } from '@prisma/engines'
import { getPlatform } from '@prisma/get-platform'
import type { Command } from '@prisma/internals'
import {
  arg,
  EngineTypeEnum,
  engineEnvVarMap,
  format,
  formatTable,
  getConfig,
  getEngineVersion,
  getSchema,
  getSchemaPath,
  HelpError,
  isError,
  loadEnvFile,
  resolveEngine,
} from '@prisma/internals'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'

import { getInstalledPrismaClientVersion } from './utils/getClientVersion'

const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

interface EngineInfo {
  path: string
  version: string
  fromEnvVar?: string
}

/**
 * $ prisma version
 */
export class Version implements Command {
  static new(): Version {
    return new Version()
  }

  private static help = format(`
  Print current version of Prisma components

  ${chalk.bold('Usage')}

    ${chalk.dim('$')} prisma -v [options]
    ${chalk.dim('$')} prisma version [options]

  ${chalk.bold('Options')}

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
    const cliQueryEngineType = getCliQueryEngineType()
    const introspectionEngine = await this.resolveEngine(EngineTypeEnum.introspectionEngine)
    const migrationEngine = await this.resolveEngine(EngineTypeEnum.migrationEngine)
    const queryEngine = await this.resolveEngine(cliQueryEngineType)
    const fmtEngine = await this.resolveEngine(EngineTypeEnum.prismaFmt)

    const prismaClientVersion = await getInstalledPrismaClientVersion()

    const rows = [
      [packageJson.name, packageJson.version],
      ['@prisma/client', prismaClientVersion ?? 'Not found'],
      ['Current platform', platform],
      [
        `Query Engine${cliQueryEngineType === EngineTypeEnum.libqueryEngine ? ' (Node-API)' : ' (Binary)'}`,
        this.printEngineInfo(queryEngine),
      ],
      ['Migration Engine', this.printEngineInfo(migrationEngine)],
      ['Introspection Engine', this.printEngineInfo(introspectionEngine)],
      ['Format Binary', this.printEngineInfo(fmtEngine)],
      ['Default Engines Hash', enginesVersion],
      ['Studio', packageJson.devDependencies['@prisma/studio-server']],
    ]

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

  private printEngineInfo({ path: absolutePath, version, fromEnvVar }: EngineInfo): string {
    const resolved = fromEnvVar ? `, resolved by ${fromEnvVar}` : ''
    return `${version} (at ${path.relative(process.cwd(), absolutePath)}${resolved})`
  }

  private async resolveEngine(engineName: EngineTypeEnum): Promise<EngineInfo> {
    const envVar = engineEnvVarMap[engineName]
    const pathFromEnv = process.env[envVar]
    if (pathFromEnv && fs.existsSync(pathFromEnv)) {
      const version = await getEngineVersion(pathFromEnv, engineName)
      return { version, path: pathFromEnv, fromEnvVar: envVar }
    }

    const enginePath = await resolveEngine(engineName)
    const version = await getEngineVersion(enginePath, engineName)
    return { path: enginePath, version }
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Version.help}`)
    }

    return Version.help
  }
}

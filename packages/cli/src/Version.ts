import { getPlatform } from '@prisma/get-platform'
import {
  arg,
  BinaryType,
  Command,
  engineEnvVarMap,
  format,
  getConfig,
  getSchema,
  getSchemaPath,
  getVersion,
  HelpError,
  isError,
  resolveBinary,
} from '@prisma/sdk'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import { getInstalledPrismaClientVersion } from './utils/getClientVersion'
const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires

interface BinaryInfo {
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

    const platform = await getPlatform()
    const useNodeAPI = process.env.PRISMA_FORCE_NAPI === 'true'
    const introspectionEngine = await this.resolveEngine(
      BinaryType.introspectionEngine,
    )
    const migrationEngine = await this.resolveEngine(BinaryType.migrationEngine)
    // TODO This conditional does not really belong here, CLI should be able to tell you which engine it is _actually_ using
    const queryEngine = await this.resolveEngine(
      useNodeAPI ? BinaryType.libqueryEngine : BinaryType.queryEngine,
    )
    const fmtBinary = await this.resolveEngine(BinaryType.prismaFmt)

    const prismaClientVersion = await getInstalledPrismaClientVersion()

    const rows = [
      [packageJson.name, packageJson.version],
      ['@prisma/client', prismaClientVersion ?? 'Not found'],
      ['Current platform', platform],
      [
        `Query Engine${useNodeAPI ? ' (Node-API)' : ''}`,
        this.printBinaryInfo(queryEngine),
      ],
      ['Migration Engine', this.printBinaryInfo(migrationEngine)],
      ['Introspection Engine', this.printBinaryInfo(introspectionEngine)],
      ['Format Binary', this.printBinaryInfo(fmtBinary)],
      [
        'Default Engines Hash',
        packageJson.dependencies['@prisma/engines'].split('.').pop(),
      ],
      ['Studio', packageJson.devDependencies['@prisma/studio-server']],
    ]

    const schemaPath = await getSchemaPath()
    const featureFlags = await this.getFeatureFlags(schemaPath)

    if (featureFlags && featureFlags.length > 0) {
      rows.push(['Preview Features', featureFlags.join(', ')])
    }

    return this.printTable(rows, args['--json'])
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
      const generator = config.generators.find(
        (g) => g.previewFeatures.length > 0,
      )
      if (generator) {
        return generator.previewFeatures
      }
    } catch (e) {
      // console.error(e)
    }
    return []
  }

  private printBinaryInfo({
    path: absolutePath,
    version,
    fromEnvVar,
  }: BinaryInfo): string {
    const resolved = fromEnvVar ? `, resolved by ${fromEnvVar}` : ''
    return `${version} (at ${path.relative(
      process.cwd(),
      absolutePath,
    )}${resolved})`
  }

  private async resolveEngine(binaryName: BinaryType): Promise<BinaryInfo> {
    const envVar = engineEnvVarMap[binaryName]
    const pathFromEnv = process.env[envVar]
    if (pathFromEnv && fs.existsSync(pathFromEnv)) {
      const version = await getVersion(pathFromEnv, binaryName)
      return { version, path: pathFromEnv, fromEnvVar: envVar }
    }

    const binaryPath = await resolveBinary(binaryName)
    const version = await getVersion(binaryPath, binaryName)
    return { path: binaryPath, version }
  }

  private printTable(rows: string[][], json = false): string {
    if (json) {
      const result = rows.reduce((acc, [name, value]) => {
        acc[slugify(name)] = value
        return acc
      }, {})
      return JSON.stringify(result, null, 2)
    }
    const maxPad = rows.reduce((acc, curr) => Math.max(acc, curr[0].length), 0)
    return rows
      .map(([left, right]) => `${left.padEnd(maxPad)} : ${right}`)
      .join('\n')
  }

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${chalk.bold.red(`!`)} ${error}\n${Version.help}`)
    }

    return Version.help
  }
}

function slugify(str: string): string {
  return str.toString().toLowerCase().replace(/\s+/g, '-')
}

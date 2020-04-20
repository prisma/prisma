import { Command, getVersion, resolveBinary, arg } from '@prisma/sdk'
import { getPlatform } from '@prisma/get-platform'
import fs from 'fs'
const packageJson = require('../package.json') // eslint-disable-line @typescript-eslint/no-var-requires
import Debug from 'debug'
const debug = Debug('version')

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

  async parse(argv: string[]): Promise<string> {
    const args = arg(argv, {
      '--json': Boolean,
    })
    const platform = await getPlatform()
    debug({ __dirname })

    const introspectionEngine = await this.resolveEngine(
      'introspection-engine',
      'PRISMA_INTROSPECTION_ENGINE_BINARY',
      platform,
    )
    const migrationEngine = await this.resolveEngine(
      'migration-engine',
      'PRISMA_MIGRATION_ENGINE_BINARY',
      platform,
    )
    const queryEngine = await this.resolveEngine(
      'query-engine',
      'PRISMA_QUERY_ENGINE_BINARY',
      platform,
    )

    const rows = [
      [packageJson.name, packageJson.version],
      ['Current platform', platform],
      ['Query Engine', this.printBinaryInfo(queryEngine)],
      ['Migration Engine', this.printBinaryInfo(migrationEngine)],
      ['Introspection Engine', this.printBinaryInfo(introspectionEngine)],
    ]

    return this.printTable(rows, args['--json'])
  }

  private printBinaryInfo({ path, version, fromEnvVar }: BinaryInfo): string {
    const resolved = fromEnvVar ? `, resolved by ${fromEnvVar}` : ''
    return `${version} (at ${path}${resolved})`
  }

  private async resolveEngine(
    binaryName: string,
    envVar: string,
    platform: string, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<BinaryInfo> {
    const pathFromEnv = process.env[envVar]
    if (pathFromEnv && fs.existsSync(pathFromEnv)) {
      const version = await getVersion(pathFromEnv)
      return { version, path: pathFromEnv, fromEnvVar: envVar }
    }

    const binaryPath = await resolveBinary(binaryName as any) // eslint-disable-line @typescript-eslint/no-explicit-any
    const version = await getVersion(binaryPath)
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
}

function slugify(str: string): string {
  return str.toString().toLowerCase().replace(/\s+/g, '-')
}

// @prisma/cli          : 2.0.0-alpha.473
// Current platform     : darwin
// Query Engine         : version (at /.../.../, resolved by PRISMA_QUERY_ENGINE_BINARY)
// Migration Engine     : version (at /.../.../)
// Introspection Engine : version (at /.../.../)

import { Command, getVersion, resolveBinary } from '@prisma/sdk'
import { getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'
import { getBinaryName } from '@prisma/fetch-engine'
const packageJson = require('../package.json')
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
  private constructor() {}
  async parse(argv: string[]) {
    const platform = await getPlatform()
    debug({ __dirname })

    const introspectionEngine = await this.resolveEngine(
      'introspection-engine',
      'PRISMA_INTROSPECTION_ENGINE_BINARY',
      platform,
    )
    const migrationEngine = await this.resolveEngine('migration-engine', 'PRISMA_MIGRATION_ENGINE_BINARY', platform)
    const queryEngine = await this.resolveEngine('query-engine', 'PRISMA_QUERY_ENGINE_BINARY', platform)

    const rows = [
      [packageJson.name, packageJson.version],
      ['Current platform', platform],
      ['Query Engine', this.printBinaryInfo(queryEngine)],
      ['Migration Engine', this.printBinaryInfo(migrationEngine)],
      ['Introspection Engine', this.printBinaryInfo(introspectionEngine)],
    ]

    return this.printTable(rows)
  }
  private printBinaryInfo({ path, version, fromEnvVar }: BinaryInfo): string {
    const resolved = fromEnvVar ? `, resolved by ${fromEnvVar}` : ''
    return `${version} (at ${path}${resolved})`
  }
  private async resolveEngine(binaryName: string, envVar: string, platform: string): Promise<BinaryInfo> {
    const pathFromEnv = process.env[envVar]
    if (pathFromEnv && fs.existsSync(pathFromEnv!)) {
      const version = await getVersion(pathFromEnv)
      return { version, path: pathFromEnv!, fromEnvVar: envVar }
    }

    const binaryPath = await resolveBinary(binaryName as any)
    const version = await getVersion(binaryPath)
    return { path: binaryPath, version }
  }
  private printTable(rows: string[][]) {
    const maxPad = rows.reduce((acc, curr) => Math.max(acc, curr[0].length), 0)
    return rows.map(([left, right]) => `${left.padEnd(maxPad)} : ${right}`).join('\n')
  }
}

// @prisma/cli          : 2.0.0-alpha.473
// Current platform     : darwin
// Query Engine         : version (at /.../.../, resolved by PRISMA_QUERY_ENGINE_BINARY)
// Migration Engine     : version (at /.../.../)
// Introspection Engine : version (at /.../.../)

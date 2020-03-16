import { Command, getVersion } from '@prisma/sdk'
import { getPlatform } from '@prisma/get-platform'
import fs from 'fs'
import path from 'path'
import { getBinaryName } from '@prisma/fetch-engine'
const packageJson = require('../package.json')

interface BinaryInfo {
  path: string
  version: string
  fromEnvVar?: string
}

/**
 * $ prisma2 version
 */
export class Version implements Command {
  static new(): Version {
    return new Version()
  }
  private constructor() {}
  async parse(argv: string[]) {
    const platform = await getPlatform()
    const introspectionEngine = await this.resolveEngine(
      'introspection-engine',
      'PRISMA_INTROSPECTION_ENGINE_BINARY',
      platform,
    )
    const migrationEngine = await this.resolveEngine('migration-engine', 'PRISMA_MIGRATION_ENGINE_BINARY', platform)
    const queryEngine = await this.resolveEngine('query-engine', 'PRISMA_QUERY_ENGINE_BINARY', platform)

    const rows = [
      ['Prisma CLI Version', `${packageJson.name}@${packageJson.version}`],
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
    if (process.env[envVar] && fs.existsSync(process.env[envVar]!)) {
      const version = await getVersion(process.env[envVar])
      return { version, path: process.env[envVar]!, fromEnvVar: envVar }
    }

    const binaryPath = path.join(__dirname, `../${getBinaryName(binaryName, platform)}`)
    const version = await getVersion(binaryPath)
    return { path: binaryPath, version }
  }
  private printTable(rows: string[][]) {
    const maxPad = rows.reduce((acc, curr) => Math.max(acc, curr[0].length), 0)
    return rows.map(([left, right]) => `${left.padEnd(maxPad)} : ${right}`).join('\n')
  }
}

// Prisma CLI Version   : prisma2@2.0.0-alpha.473
// Current platform     : darwin
// Query Engine         : version (at /.../.../, resolved by PRISMA_QUERY_ENGINE_BINARY)
// Migration Engine     : version (at /.../.../)
// Introspection Engine : version (at /.../.../)

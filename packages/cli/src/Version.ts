import fs from 'fs'
import type { PrismaConfigInternal } from '@prisma/config'
import { enginesVersion } from '@prisma/engines'
import {
  arg,
  BinaryType,
  Command,
  createSchemaPathInput,
  format,
  formatTable,
  getEnginesInfo,
  getTypescriptVersion,
  HelpError,
  isError,
  loadSchemaContext,
  resolveEngine,
  resolvePkg,
  wasm,
} from '@prisma/internals'
import { bold, dim, red } from 'kleur/colors'
import path from 'path'
import os from 'os'

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

  public help(error?: string): string | HelpError {
    if (error) {
      return new HelpError(`\n${bold(red(`!`))} ${error}\n${Version.help}`)
    }

    return Version.help
  }

  async parse(argv: string[], config: PrismaConfigInternal, baseDir: string = process.cwd()): Promise<string | Error> {
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

    const engineResult = await resolveEngine(BinaryType.SchemaEngineBinary)
    const [enginesInfo, schemaEngineRetrievalErrors] = getEnginesInfo(engineResult)

    const schemaEngineRows = [['Schema Engine', enginesInfo] as const]

    const prismaClientVersion = await getInstalledPrismaClientVersion()
    const typescriptVersion = await getTypescriptVersion()
    const prismaInstallPath = await this.getPrismaInstallPath()

    const rows = [
      [packageJson.name, packageJson.version],
      ['Current Prisma Path', prismaInstallPath],
      ['@prisma/client', prismaClientVersion ?? 'Not found'],
      ['Operating System', os.platform()],
      ['Architecture', os.arch()],
      ['Node.js', process.version],
      ['TypeScript', typescriptVersion],
      ['Query Compiler', 'enabled'],
      ['PSL', `@prisma/prisma-schema-wasm ${wasm.prismaSchemaWasmVersion}`],
      ...schemaEngineRows,

      ['Default Engines Hash', enginesVersion],
      ['Studio', packageJson.dependencies['@prisma/studio-core']],
    ]

    /**
     * If reading Rust engines metainfo (like their git hash) failed, display the errors to stderr,
     * and let Node.js exit naturally, but with error code 1.
     */

    if (schemaEngineRetrievalErrors.length > 0) {
      process.exitCode = 1
      schemaEngineRetrievalErrors.forEach((e) => console.error(e))
    }

    const featureFlags = await this.getFeatureFlags(config.schema, baseDir)
    if (featureFlags && featureFlags.length > 0) {
      rows.push(['Preview Features', featureFlags.join(', ')])
    }

    // @ts-ignore TODO @jkomyno, as affects the type of rows
    return formatTable(rows, { json: args['--json'] })
  }

  private async getPrismaInstallPath(): Promise<string> {
    const prismaEntryPoint = process.argv[1] ? this.safeRealpath(process.argv[1]) : undefined
    const basedir = prismaEntryPoint ? path.dirname(prismaEntryPoint) : this.safeRealpath(process.cwd())
    const packageRoot = prismaEntryPoint ? this.getPackageRootFromFile(prismaEntryPoint) ?? basedir : basedir

    return (
      (await resolvePkg('prisma', { basedir })) ??
      (await resolvePkg('prisma', { basedir: packageRoot })) ??
      packageRoot
    )
  }

  private safeRealpath(filePath: string): string {
    try {
      return fs.realpathSync(filePath)
    } catch {
      return path.resolve(filePath)
    }
  }

  private getPackageRootFromFile(filePath: string): string | undefined {
    let currentDir = path.dirname(filePath)

    while (currentDir !== path.dirname(currentDir)) {
      const packageJsonPath = path.join(currentDir, 'package.json')
      if (fs.existsSync(packageJsonPath)) {
        try {
          const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
          if (packageJson.name === 'prisma') {
            return currentDir
          }
        } catch {
          return undefined
        }
      }

      currentDir = path.dirname(currentDir)
    }

    return undefined
  }

  private async getFeatureFlags(schemaPath: string | undefined, baseDir: string): Promise<string[]> {
    try {
      const { generators } = await loadSchemaContext({
        schemaPath: createSchemaPathInput({ schemaPathFromConfig: schemaPath, baseDir }),
      })
      const generator = generators.find((g) => g.previewFeatures.length > 0)
      if (generator) {
        return generator.previewFeatures
      }
    } catch (e) {
      // console.error(e)
    }
    return []
  }
}

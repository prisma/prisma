import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import type { Platform } from '@prisma/get-platform'
import { getNodeAPIName, getPlatform, getPlatformWithOSResult } from '@prisma/get-platform'
import chalk from 'chalk'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { EngineConfig } from '../common/Engine'
import { PrismaClientInitializationError } from '../common/errors/PrismaClientInitializationError'
import { handleLibraryLoadingErrors } from '../common/errors/utils/handleEngineLoadingErrors'
import { printGeneratorConfig } from '../common/utils/printGeneratorConfig'
import { fixBinaryTargets } from '../common/utils/util'
import { runInChildSpan } from '../tracing'
import { Library, LibraryLoader } from './types/Library'

const debug = Debug('prisma:client:libraryEngine:loader')

export function load<T>(id: string): T {
  // `toNamespacedPath` is required for native addons on Windows, but it's a no-op on other systems.
  // We call it here unconditionally just like `.node` CommonJS loader in Node.js does.
  const libraryPath = path.toNamespacedPath(id)
  const libraryModule = { exports: {} as T }

  let flags = 0

  if (process.platform !== 'win32') {
    // Add RTLD_LAZY on Unix. This is what Node.js does by default
    // if no flags were passed to dlopen from JavaScript side.
    //
    // @ts-expect-error TODO: typings don't define dlopen -- needs to be fixed upstream
    flags |= os.constants.dlopen.RTLD_LAZY
  }

  if (process.platform === 'linux') {
    // Add RTLD_DEEPBIND on Linux. This is a non-standard GNU
    // extension and not part of POSIX, so we don't do that on other
    // Unix systems. This prevents issues when we dynamically link to
    // system OpenSSL on Linux but the dynamic linker resolves the
    // symbols from the Node.js binary instead.
    //
    // @ts-expect-error TODO: typings don't define dlopen -- needs to be fixed upstream
    flags |= os.constants.dlopen.RTLD_DEEPBIND
  }

  // @ts-expect-error TODO: typings don't define dlopen -- needs to be fixed upstream
  process.dlopen(libraryModule, libraryPath, flags)

  return libraryModule.exports
}

export class DefaultLibraryLoader implements LibraryLoader {
  private config: EngineConfig
  private libQueryEnginePath: string | null = null
  private platform: Platform | null = null

  constructor(config: EngineConfig) {
    this.config = config
  }

  async loadLibrary(): Promise<Library> {
    const platformInfo = await getPlatformWithOSResult()
    this.platform = platformInfo.binaryTarget
    if (!this.libQueryEnginePath) {
      this.libQueryEnginePath = await this.getLibQueryEnginePath()
    }

    debug(`loadEngine using ${this.libQueryEnginePath}`)
    try {
      const enginePath = this.libQueryEnginePath
      return runInChildSpan({ name: 'loadLibrary', enabled: this.config.tracingConfig.enabled, internal: true }, () =>
        load(enginePath),
      )
    } catch (e) {
      const errorMessage = handleLibraryLoadingErrors({
        e: e as Error,
        platformInfo,
        id: this.libQueryEnginePath,
      })

      throw new PrismaClientInitializationError(errorMessage, this.config.clientVersion!)
    }
  }

  private async getLibQueryEnginePath(): Promise<string> {
    const libPath = process.env.PRISMA_QUERY_ENGINE_LIBRARY ?? this.config.prismaPath
    if (libPath && fs.existsSync(libPath) && libPath.endsWith('.node')) {
      return libPath
    }
    this.platform = this.platform ?? (await getPlatform())
    const { enginePath, searchedLocations } = await this.resolveEnginePath()
    // If path to query engine doesn't exist, throw
    if (!fs.existsSync(enginePath)) {
      const incorrectPinnedPlatformErrorStr = this.platform
        ? `\nYou incorrectly pinned it to ${chalk.redBright.bold(`${this.platform}`)}\n`
        : ''
      // TODO Stop searching in many locations, have more deterministic logic.
      let errorText = `Query engine library for current platform "${chalk.bold(
        this.platform,
      )}" could not be found.${incorrectPinnedPlatformErrorStr}
This probably happens, because you built Prisma Client on a different platform.
(Prisma Client looked in "${chalk.underline(enginePath)}")

Searched Locations:

${searchedLocations
  .map((f) => {
    let msg = `  ${f}`
    if (process.env.DEBUG === 'node-engine-search-locations' && fs.existsSync(f)) {
      const dir = fs.readdirSync(f)
      msg += dir.map((d) => `    ${d}`).join('\n')
    }
    return msg
  })
  .join('\n' + (process.env.DEBUG === 'node-engine-search-locations' ? '\n' : ''))}\n`
      // The generator should always be there during normal usage
      if (this.config.generator) {
        // The user already added it, but it still doesn't work 🤷‍♀️
        // That means, that some build system just deleted the files 🤔
        this.platform = this.platform ?? (await getPlatform())
        if (
          this.config.generator.binaryTargets.find((object) => object.value === this.platform!) ||
          this.config.generator.binaryTargets.find((object) => object.value === 'native')
        ) {
          errorText += `
You already added the platform${
            this.config.generator.binaryTargets.length > 1 ? 's' : ''
          } ${this.config.generator.binaryTargets
            .map((t) => `"${chalk.bold(t.value)}"`)
            .join(', ')} to the "${chalk.underline('generator')}" block
in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
but something went wrong. That's suboptimal.

Please create an issue at https://github.com/prisma/prisma/issues/new`
          errorText += ``
        } else {
          // If they didn't even have the current running platform in the schema.prisma file, it's easy
          // Just add it
          errorText += `\n\nTo solve this problem, add the platform "${this.platform}" to the "${chalk.underline(
            'binaryTargets',
          )}" attribute in the "${chalk.underline('generator')}" block in the "schema.prisma" file:
${chalk.greenBright(this.getFixedGenerator())}

Then run "${chalk.greenBright('prisma generate')}" for your changes to take effect.
Read more about deploying Prisma Client: https://pris.ly/d/client-generator`
        }
      } else {
        errorText += `\n\nRead more about deploying Prisma Client: https://pris.ly/d/client-generator\n`
      }

      throw new PrismaClientInitializationError(errorText, this.config.clientVersion!)
    }
    this.platform = this.platform ?? (await getPlatform())
    return enginePath
  }

  private async resolveEnginePath(): Promise<{
    enginePath: string
    searchedLocations: string[]
  }> {
    const searchedLocations: string[] = []
    let enginePath: string
    if (this.libQueryEnginePath) {
      return { enginePath: this.libQueryEnginePath, searchedLocations }
    }

    this.platform = this.platform ?? (await getPlatform())

    // TODO Why special case dependent on file name?
    if (__filename.includes('DefaultLibraryLoader')) {
      enginePath = path.join(getEnginesPath(), getNodeAPIName(this.platform, 'fs'))
      return { enginePath, searchedLocations }
    }

    const dirname = eval('__dirname') as string
    const searchLocations: string[] = [
      // TODO: why hardcoded path? why not look for .prisma/client upwards?
      path.resolve(dirname, '../../../.prisma/client'), // Dot Prisma Path
      this.config.generator?.output?.value ?? dirname, // Custom Generator Path
      path.resolve(dirname, '..'), // parentDirName
      path.dirname(this.config.datamodelPath), // Datamodel Dir
      this.config.cwd, //cwdPath
      '/tmp/prisma-engines',
    ]

    if (this.config.dirname) {
      searchLocations.push(this.config.dirname)
    }

    for (const location of searchLocations) {
      searchedLocations.push(location)
      debug(`Searching for Query Engine Library in ${location}`)
      enginePath = path.join(location, getNodeAPIName(this.platform, 'fs'))
      if (fs.existsSync(enginePath)) {
        return { enginePath, searchedLocations }
      }
    }
    enginePath = path.join(__dirname, getNodeAPIName(this.platform, 'fs'))

    return { enginePath, searchedLocations }
  }

  // TODO Fixed as in "not broken" or fixed as in "written down"? If any of these, why and how and where?
  private getFixedGenerator(): string {
    const fixedGenerator = {
      ...this.config.generator!,
      binaryTargets: fixBinaryTargets(this.config.generator!.binaryTargets, this.platform!),
    }

    return printGeneratorConfig(fixedGenerator)
  }
}

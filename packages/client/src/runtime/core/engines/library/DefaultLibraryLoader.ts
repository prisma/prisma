import Debug from '@prisma/debug'
import { getEnginesPath } from '@prisma/engines'
import type { Platform } from '@prisma/get-platform'
import { getNodeAPIName, getPlatform, getPlatformWithOSResult } from '@prisma/get-platform'
import { fixBinaryTargets, handleLibraryLoadingErrors, printGeneratorConfig } from '@prisma/internals'
import fs from 'fs'
import { bold, green, red, underline } from 'kleur/colors'
import os from 'os'
import path from 'path'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { EngineConfig } from '../common/Engine'
import { Library, LibraryLoader } from './types/Library'

const debug = Debug('prisma:client:libraryEngine:loader')

const libraryCacheSymbol = Symbol('PrismaLibraryEngineCache')

type LibraryCache = Record<string, Library | undefined>

type GlobalWithCache = typeof globalThis & {
  [libraryCacheSymbol]?: LibraryCache
}

function getLibraryCache(): LibraryCache {
  const globalWithCache = globalThis as GlobalWithCache
  if (globalWithCache[libraryCacheSymbol] === undefined) {
    globalWithCache[libraryCacheSymbol] = {}
  }
  return globalWithCache[libraryCacheSymbol]
}

export function load(libraryPath: string): Library {
  const cache = getLibraryCache()

  if (cache[libraryPath] !== undefined) {
    return cache[libraryPath]!
  }

  // `toNamespacedPath` is required for native addons on Windows, but it's a no-op on other systems.
  // We call it here unconditionally just like `.node` CommonJS loader in Node.js does.
  const fullLibraryPath = path.toNamespacedPath(libraryPath)
  const libraryModule = { exports: {} as Library }

  let flags = 0

  if (process.platform !== 'win32') {
    // Add RTLD_LAZY and RTLD_DEEPBIND on Unix.
    //
    // RTLD_LAZY: this is what Node.js uses by default on all Unix-like systems
    // if no flags were passed to dlopen from JavaScript side.
    //
    // RTLD_DEEPBIND: this is not a part of POSIX standard but a widely
    // supported extension. It prevents issues when we dynamically link to
    // system OpenSSL on Linux but the dynamic linker resolves the symbols from
    // the Node.js binary instead.
    //
    // @ts-expect-error TODO: typings don't define dlopen -- needs to be fixed upstream
    flags = os.constants.dlopen.RTLD_LAZY | os.constants.dlopen.RTLD_DEEPBIND
  }

  // @ts-expect-error TODO: typings don't define dlopen -- needs to be fixed upstream
  process.dlopen(libraryModule, fullLibraryPath, flags)

  cache[libraryPath] = libraryModule.exports
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
      return this.config.tracingHelper.runInChildSpan({ name: 'loadLibrary', internal: true }, () => load(enginePath))
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
        ? `\nYou incorrectly pinned it to ${bold(red(`${this.platform}`))}\n`
        : ''
      // TODO Stop searching in many locations, have more deterministic logic.
      let errorText = `Query engine library for current platform "${bold(
        this.platform,
      )}" could not be found.${incorrectPinnedPlatformErrorStr}
This probably happens, because you built Prisma Client on a different platform.
(Prisma Client looked in "${underline(enginePath)}")

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
          } ${this.config.generator.binaryTargets.map((t) => `"${bold(t.value)}"`).join(', ')} to the "${underline(
            'generator',
          )}" block
in the "schema.prisma" file as described in https://pris.ly/d/client-generator,
but something went wrong. That's suboptimal.

Please create an issue at https://github.com/prisma/prisma/issues/new`
          errorText += ``
        } else {
          // If they didn't even have the current running platform in the schema.prisma file, it's easy
          // Just add it
          errorText += `\n\nTo solve this problem, add the platform "${this.platform}" to the "${underline(
            'binaryTargets',
          )}" attribute in the "${underline('generator')}" block in the "schema.prisma" file:
${green(this.getFixedGenerator())}

Then run "${green('prisma generate')}" for your changes to take effect.
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

    const searchLocations: string[] = [
      path.dirname(this.config.datamodelPath),
    ]

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

import Debug from '@prisma/debug'
import { getNodeAPIName, getPlatformInfo, Platform } from '@prisma/get-platform'
import { fixBinaryTargets, handleLibraryLoadingErrors, printGeneratorConfig } from '@prisma/internals'
import fs from 'fs'
import os from 'os'
import path from 'path'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { EngineConfig } from '../common/Engine'
import { binaryTargetsWasIncorrectlyPinned } from '../common/errors/engine-not-found/binaryTargetsWasIncorrectlyPinned'
import { bundlerHasTamperedWithEngineCopy } from '../common/errors/engine-not-found/bundlerHasTamperedWithEngineCopy'
import { EngineNotFoundErrorInput } from '../common/errors/engine-not-found/EngineNotFoundErrorInput'
import { nativeGeneratedOnDifferentPlatform } from '../common/errors/engine-not-found/nativeGeneratedOnDifferentPlatform'
import { toolingHasTamperedWithEngineCopy } from '../common/errors/engine-not-found/toolingHasTamperedWithEngineCopy'
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
  private libQueryEnginePath?: string
  private binaryTarget!: Platform

  constructor(config: EngineConfig) {
    this.config = config
  }

  async loadLibrary(): Promise<Library> {
    const platformInfo = await getPlatformInfo()
    this.binaryTarget = platformInfo.binaryTarget

    if (this.libQueryEnginePath === undefined) {
      this.libQueryEnginePath = this.getLibQueryEnginePath()
    }

    const enginePath = this.libQueryEnginePath
    debug(`loadEngine using ${enginePath}`)

    try {
      return this.config.tracingHelper.runInChildSpan({ name: 'loadLibrary', internal: true }, () => load(enginePath))
    } catch (e) {
      const errorMessage = handleLibraryLoadingErrors({ e: e as Error, platformInfo, id: enginePath })

      throw new PrismaClientInitializationError(errorMessage, this.config.clientVersion!)
    }
  }

  private getLibQueryEnginePath() {
    // if the user provided a custom prismaPath, we will use that one
    const libPath = process.env.PRISMA_QUERY_ENGINE_LIBRARY ?? this.config.prismaPath
    if (libPath !== undefined && fs.existsSync(libPath) && libPath.endsWith('.node')) {
      return libPath
    }

    // otherwise we will search to find the nearest query engine file
    const { enginePath, searchedLocations } = this.resolveEnginePath()

    if (enginePath !== undefined) return enginePath

    const generatorBinaryTargets = this.config.generator?.binaryTargets ?? []
    const hasNativeBinaryTarget = generatorBinaryTargets.some((bt) => bt.native === true)
    const hasMissingBinaryTarget = !generatorBinaryTargets.some((bt) => bt.value === this.binaryTarget)
    const clientHasBeenBundled = __filename.match(/library\.m?js/) === null // runtime bundle name

    const errorInput: EngineNotFoundErrorInput = {
      searchedLocations,
      generatorBinaryTargets,
      generator: this.config.generator!,
      runtimeBinaryTarget: this.binaryTarget,
      expectedLocation: path.relative(process.cwd(), this.config.dirname), // TODO pathToPosix
    }

    let errorMessage: string | undefined
    if (hasNativeBinaryTarget && hasMissingBinaryTarget) {
      errorMessage = nativeGeneratedOnDifferentPlatform(errorInput)
    } else if (hasMissingBinaryTarget) {
      errorMessage = binaryTargetsWasIncorrectlyPinned(errorInput)
    } else if (clientHasBeenBundled) {
      errorMessage = bundlerHasTamperedWithEngineCopy(errorInput)
    } else {
      errorMessage = toolingHasTamperedWithEngineCopy(errorInput)
    }

    throw new PrismaClientInitializationError(errorMessage, this.config.clientVersion!)
  }

  private resolveEnginePath() {
    const searchedLocations: string[] = []

    if (this.libQueryEnginePath !== undefined) {
      return { enginePath: this.libQueryEnginePath, searchedLocations }
    }

    const dirname = eval('__dirname') as string
    const searchLocations: string[] = [
      this.config.dirname, // Generation Dir
      // TODO: why hardcoded path? why not look for .prisma/client upwards?
      path.resolve(dirname, '../../../.prisma/client'), // Dot Prisma Path
      this.config.generator?.output?.value ?? dirname, // Custom Generator Path
      path.resolve(dirname, '..'), // parentDirName
      this.config.cwd, //cwdPath
      '/tmp/prisma-engines',
    ]

    for (const location of searchLocations) {
      debug(`Searching for Query Engine Library in ${location}`)

      const engineName = getNodeAPIName(this.binaryTarget, 'fs')
      const enginePath = path.join(location, engineName)

      searchedLocations.push(location)
      if (fs.existsSync(enginePath)) {
        return { enginePath, searchedLocations }
      }
    }

    return { enginePath: undefined, searchedLocations }
  }

  private getGeneratorBlockSuggestion(): string {
    const fixedGenerator = {
      ...this.config.generator!,
      binaryTargets: fixBinaryTargets(this.config.generator!.binaryTargets, this.binaryTarget),
    }

    return printGeneratorConfig(fixedGenerator)
  }
}

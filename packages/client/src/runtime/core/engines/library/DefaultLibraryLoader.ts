import { getPlatformInfo } from '@prisma/get-platform'
import { handleLibraryLoadingErrors } from '@prisma/internals'
import os from 'os'
import path from 'path'

import { PrismaClientInitializationError } from '../../errors/PrismaClientInitializationError'
import { EngineConfig } from '../common/Engine'
import { resolveEnginePath } from '../common/resolveEnginePath'
import { Library, LibraryLoader } from './types/Library'

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

  constructor(config: EngineConfig) {
    this.config = config
  }

  async loadLibrary(): Promise<Library> {
    const platformInfo = await getPlatformInfo()
    const enginePath = await resolveEnginePath('library', this.config)

    try {
      return this.config.tracingHelper.runInChildSpan({ name: 'loadLibrary', internal: true }, () => load(enginePath))
    } catch (e) {
      const errorMessage = handleLibraryLoadingErrors({ e: e as Error, platformInfo, id: enginePath })

      throw new PrismaClientInitializationError(errorMessage, this.config.clientVersion!)
    }
  }
}

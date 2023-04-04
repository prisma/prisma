import os from 'os'
import path from 'path'

import { DefaultLibraryLoader } from './DefaultLibraryLoader'
import { Library } from './types/Library'

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

export class LinuxLibraryLoader extends DefaultLibraryLoader {
  protected override loadLibraryByPath(id: string): Library {
    const cache = getLibraryCache()

    if (cache[id] !== undefined) {
      return cache[id]!
    }

    // `toNamespacedPath` is required for native addons on Windows, but it's a no-op on other systems.
    // We call it here unconditionally just like `.node` CommonJS loader in Node.js does.
    const libraryPath = path.toNamespacedPath(id)
    const libraryModule = { exports: {} as Library }

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

    cache[id] = libraryModule.exports
    return libraryModule.exports
  }
}

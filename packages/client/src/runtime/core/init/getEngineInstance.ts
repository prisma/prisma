import { PrismaClientValidationError } from '@prisma/client-runtime-utils'
import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { ClientEngine, Engine, EngineConfig, LibraryEngine } from '../engines'

/**
 * Get the engine instance based on the runtime bundle type and engine configuration.
 */
export function getEngineInstance(engineConfig: EngineConfig): Engine {
  const engineType = getClientEngineType(engineConfig.generator!)

  const libraryEngineConfigured = engineType === ClientEngineType.Library
  const clientEngineConfigured = engineType === ClientEngineType.Client

  if (clientEngineConfigured && TARGET_BUILD_TYPE === 'client') return new ClientEngine(engineConfig)
  else if (clientEngineConfigured && TARGET_BUILD_TYPE === 'wasm-compiler-edge') return new ClientEngine(engineConfig)
  else if (libraryEngineConfigured && TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  // reasonable fallbacks in case the conditions above aren't met, we should still try the correct engine
  else if (TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  else if (TARGET_BUILD_TYPE === 'client') return new ClientEngine(engineConfig)
  // if either accelerate or wasm library could not be loaded for some reason, we throw an error
  else if (TARGET_BUILD_TYPE === 'wasm-compiler-edge') {
    return new MisconfiguredEngine({ clientVersion: engineConfig.clientVersion }) as Engine
  }

  return TARGET_BUILD_TYPE satisfies never
}

class MisconfiguredEngine {
  constructor(options: { clientVersion: string }) {
    return new Proxy(this, {
      get(_target, _prop) {
        const message = `In order to run Prisma Client on edge runtime, either:
- Use Prisma Accelerate: https://pris.ly/d/accelerate
- Use Driver Adapters: https://pris.ly/d/driver-adapters`

        throw new PrismaClientValidationError(message, options)
      },
    })
  }
}

import { GetPrismaClientConfig } from '@prisma/client-common'
import { ClientEngineType, getClientEngineType, warnOnce } from '@prisma/internals'

import { BinaryEngine, ClientEngine, DataProxyEngine, Engine, EngineConfig, LibraryEngine } from '../engines'
import { AccelerateEngine } from '../engines/accelerate/AccelerateEngine'
import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'
import { resolveDatasourceUrl } from './resolveDatasourceUrl'
import { validateEngineInstanceConfig } from './validateEngineInstanceConfig'

/**
 * Get the engine instance based on the engine type and the target engine type
 * (binary, library, data proxy). If the URL is a prisma:// URL, it will always
 * use the DataProxyEngine. Basically decides which engine to load.
 * @param clientConfig
 * @param engineConfig
 * @returns
 */
export function getEngineInstance({ copyEngine = true }: GetPrismaClientConfig, engineConfig: EngineConfig): Engine {
  let url: string | undefined

  try {
    url = resolveDatasourceUrl({
      inlineDatasources: engineConfig.inlineDatasources,
      overrideDatasources: engineConfig.overrideDatasources,
      env: { ...engineConfig.env, ...process.env },
      clientVersion: engineConfig.clientVersion,
    })
  } catch {
    // the error does not matter, but that means we don't have a valid url which
    // means we can't use the DataProxyEngine and will default to LibraryEngine
  }

  const { ok, isUsing, diagnostics } = validateEngineInstanceConfig({
    url,
    adapter: engineConfig.adapter,
    copyEngine,
    targetBuildType: TARGET_BUILD_TYPE,
  })

  for (const warning of diagnostics.warnings) {
    warnOnce(...warning.value)
  }

  if (!ok) {
    const error = diagnostics.errors[0]
    throw new PrismaClientValidationError(error.value, { clientVersion: engineConfig.clientVersion })
  }

  const engineType = getClientEngineType(engineConfig.generator!)

  const libraryEngineConfigured = engineType === ClientEngineType.Library
  const binaryEngineConfigured = engineType === ClientEngineType.Binary
  const clientEngineConfigured = engineType === ClientEngineType.Client

  // TODO: one day we may want to completely deprecate `@prisma/client/edge` in favor of wasm build
  // TODO: After having moved the DataProxyEngine to Accelerate
  // - Replace DataProxyEngine with AccelerateEngine via `@prisma/extension-accelerate`
  // - Delete DataProxyEngine and all related files
  // - Update the DataProxy tests to use the /wasm endpoint, but keep ecosystem-tests as they are

  // When a local driver adapter is configured, the URL from the datasource
  // block in the Prisma schema is no longer relevant as driver adapters don't
  // use it. Therefore, a configured driver adapter takes precedence over the
  // Accelerate or PPg URL in the schema file.
  const clientEngineUsesRemoteExecutor = (isUsing.accelerate || isUsing.ppg) && !isUsing.driverAdapters

  if (TARGET_BUILD_TYPE === 'react-native') return new LibraryEngine(engineConfig)
  else if (clientEngineConfigured && TARGET_BUILD_TYPE === 'client')
    return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
  else if (clientEngineConfigured && TARGET_BUILD_TYPE === 'wasm-compiler-edge')
    return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
  else if (isUsing.accelerate && TARGET_BUILD_TYPE !== 'wasm-engine-edge') return new DataProxyEngine(engineConfig)
  else if (isUsing.driverAdapters && TARGET_BUILD_TYPE === 'wasm-engine-edge') return new LibraryEngine(engineConfig)
  else if (libraryEngineConfigured && TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  else if (binaryEngineConfigured && TARGET_BUILD_TYPE === 'binary') return new BinaryEngine(engineConfig)
  else if (isUsing.accelerate && TARGET_BUILD_TYPE === 'wasm-engine-edge') return new DataProxyEngine(engineConfig)
  // reasonable fallbacks in case the conditions above aren't met, we should still try the correct engine
  else if (TARGET_BUILD_TYPE === 'edge') return new DataProxyEngine(engineConfig)
  else if (TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  else if (TARGET_BUILD_TYPE === 'binary') return new BinaryEngine(engineConfig)
  else if (TARGET_BUILD_TYPE === 'client') return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
  // if either accelerate or wasm library could not be loaded for some reason, we throw an error
  else if (TARGET_BUILD_TYPE === 'wasm-engine-edge' || TARGET_BUILD_TYPE === 'wasm-compiler-edge') {
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

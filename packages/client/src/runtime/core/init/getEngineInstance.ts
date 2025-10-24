import { GetPrismaClientConfig } from '@prisma/client-common'
import { PrismaClientValidationError } from '@prisma/client-runtime-utils'
import { ClientEngineType, getClientEngineType, warnOnce } from '@prisma/internals'

import { BinaryEngine, ClientEngine, Engine, EngineConfig, LibraryEngine } from '../engines'
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
export function getEngineInstance(_: GetPrismaClientConfig, engineConfig: EngineConfig): Engine {
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

  // When a local driver adapter is configured, the URL from the datasource
  // block in the Prisma schema is no longer relevant as driver adapters don't
  // use it. Therefore, a configured driver adapter takes precedence over the
  // Accelerate or PPg URL in the schema file.
  const clientEngineUsesRemoteExecutor = (isUsing.accelerate || isUsing.ppg) && !isUsing.driverAdapters

  if (clientEngineConfigured && TARGET_BUILD_TYPE === 'client')
    return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
  else if (clientEngineConfigured && TARGET_BUILD_TYPE === 'wasm-compiler-edge')
    return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
  else if (libraryEngineConfigured && TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  else if (binaryEngineConfigured && TARGET_BUILD_TYPE === 'binary') return new BinaryEngine(engineConfig)
  // reasonable fallbacks in case the conditions above aren't met, we should still try the correct engine
  else if (TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  else if (TARGET_BUILD_TYPE === 'binary') return new BinaryEngine(engineConfig)
  else if (TARGET_BUILD_TYPE === 'client') return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
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

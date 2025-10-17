import { GetPrismaClientConfig } from '@prisma/client-common'
import { warnOnce } from '@prisma/internals'

import { ClientEngine, DataProxyEngine, Engine, EngineConfig } from '../engines'
import { AccelerateEngine } from '../engines/accelerate/AccelerateEngine'
import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'
import { resolveDatasourceUrl } from './resolveDatasourceUrl'
import { validateEngineInstanceConfig } from './validateEngineInstanceConfig'

/**
 * Get the engine instance based on the engine type and target build type.
 * Uses ClientEngine for local execution, DataProxyEngine or AccelerateEngine for remote execution.
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
    // means we can't use DataProxyEngine/AccelerateEngine and will default to ClientEngine
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

  // When a local driver adapter is configured, the URL from the datasource
  // block in the Prisma schema is no longer relevant as driver adapters don't
  // use it. Therefore, a configured driver adapter takes precedence over the
  // Accelerate or PPg URL in the schema file.
  const clientEngineUsesRemoteExecutor = (isUsing.accelerate || isUsing.ppg) && !isUsing.driverAdapters

  // React Native always uses ClientEngine
  if (TARGET_BUILD_TYPE === 'react-native') {
    return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
  }

  // Client and wasm-compiler-edge builds use ClientEngine
  if (TARGET_BUILD_TYPE === 'client' || TARGET_BUILD_TYPE === 'wasm-compiler-edge') {
    return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
  }

  // Handle Accelerate/PPg for non-wasm-engine-edge builds
  if (isUsing.accelerate && TARGET_BUILD_TYPE !== 'wasm-engine-edge') {
    return new DataProxyEngine(engineConfig)
  }

  // Handle wasm-engine-edge builds
  if (TARGET_BUILD_TYPE === 'wasm-engine-edge') {
    if (isUsing.accelerate && !isUsing.driverAdapters) {
      return new AccelerateEngine(engineConfig)
    }
    return new MisconfiguredEngine({ clientVersion: engineConfig.clientVersion }) as Engine
  }

  // Legacy build types (library, binary) use ClientEngine
  if (TARGET_BUILD_TYPE === 'library' || TARGET_BUILD_TYPE === 'binary') {
    return new ClientEngine(engineConfig, clientEngineUsesRemoteExecutor)
  }

  // Fallback for edge builds
  if (TARGET_BUILD_TYPE === 'edge') {
    return new DataProxyEngine(engineConfig)
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

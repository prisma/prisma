import { ClientEngineType, getClientEngineType, isPrismaPostgres, warnOnce } from '@prisma/internals'

import type { GetPrismaClientConfig } from '../../getPrismaClient'
import { getRuntime } from '../../utils/getRuntime'
import { BinaryEngine, ClientEngine, DataProxyEngine, type EngineConfig, LibraryEngine } from '../engines'
import { AccelerateEngine } from '../engines/accelerate/AccelerateEngine'
import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'
import { resolveDatasourceUrl } from './resolveDatasourceUrl'

/**
 * Get the engine instance based on the engine type and the target engine type
 * (binary, library, data proxy). If the URL is a prisma:// URL, it will always
 * use the DataProxyEngine. Basically decides which engine to load.
 * @param clientConfig
 * @param engineConfig
 * @returns
 */
export function getEngineInstance({ copyEngine = true }: GetPrismaClientConfig, engineConfig: EngineConfig) {
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

  const isAccelerateUrlScheme = Boolean(url?.startsWith('prisma://') || isPrismaPostgres(url))

  if (copyEngine && isAccelerateUrlScheme) {
    warnOnce(
      'recommend--no-engine',
      'In production, we recommend using `prisma generate --no-engine` (See: `prisma generate --help`)',
    )
  }

  const engineType = getClientEngineType(engineConfig.generator!)

  const accelerateConfigured = isAccelerateUrlScheme || !copyEngine
  const driverAdapterConfigured = Boolean(engineConfig.adapter)
  const libraryEngineConfigured = engineType === ClientEngineType.Library
  const binaryEngineConfigured = engineType === ClientEngineType.Binary
  const clientEngineConfigured = engineType === ClientEngineType.Client

  if ((accelerateConfigured && driverAdapterConfigured) || (driverAdapterConfigured && TARGET_BUILD_TYPE === 'edge')) {
    let message: string[]

    if (TARGET_BUILD_TYPE === 'edge') {
      message = [
        'Prisma Client was configured to use the `adapter` option but it was imported via its `/edge` endpoint.',
        'Please either remove the `/edge` endpoint or remove the `adapter` from the Prisma Client constructor.',
      ]
    } else if (!copyEngine) {
      message = [
        'Prisma Client was configured to use the `adapter` option but `prisma generate` was run with `--no-engine`.',
        'Please run `prisma generate` without `--no-engine` to be able to use Prisma Client with the adapter.',
      ]
    } else if (url?.startsWith('prisma://')) {
      message = [
        'Prisma Client was configured to use the `adapter` option but the URL was a `prisma://` URL.',
        'Please either use the `prisma://` URL or remove the `adapter` from the Prisma Client constructor.',
      ]
    } else {
      message = ['Prisma Client was configured to use both the `adapter` and Accelerate, please chose one.']
    }

    throw new PrismaClientValidationError(message.join('\n'), { clientVersion: engineConfig.clientVersion })
  }

  // TODO: one day we may want to completely deprecate `@prisma/client/edge` in favor of wasm build
  // TODO: After having moved the DataProxyEngine to Accelerate
  // - Replace DataProxyEngine with AccelerateEngine via `@prisma/extension-accelerate`
  // - Delete DataProxyEngine and all related files
  // - Update the DataProxy tests to use the /wasm endpoint, but keep ecosystem-tests as they are

  if (TARGET_BUILD_TYPE === 'react-native') return new LibraryEngine(engineConfig)
  if (accelerateConfigured && TARGET_BUILD_TYPE !== 'wasm') return new DataProxyEngine(engineConfig)
  if (driverAdapterConfigured && TARGET_BUILD_TYPE === 'wasm') return new LibraryEngine(engineConfig)
  if (libraryEngineConfigured && TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  if (binaryEngineConfigured && TARGET_BUILD_TYPE === 'binary') return new BinaryEngine(engineConfig)
  if (accelerateConfigured && TARGET_BUILD_TYPE === 'wasm') return new AccelerateEngine(engineConfig)
  if (clientEngineConfigured && TARGET_BUILD_TYPE === 'client') return new ClientEngine(engineConfig)
  // reasonable fallbacks in case the conditions above aren't met, we should still try the correct engine
  if (TARGET_BUILD_TYPE === 'edge') return new DataProxyEngine(engineConfig)
  if (TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  if (TARGET_BUILD_TYPE === 'binary') return new BinaryEngine(engineConfig)
  if (TARGET_BUILD_TYPE === 'client') return new ClientEngine(engineConfig)
  // if either accelerate or wasm library could not be loaded for some reason, we throw an error
  if (TARGET_BUILD_TYPE === 'wasm') {
    const message = [
      `PrismaClient failed to initialize because it wasn't configured to run in this environment (${
        getRuntime().prettyName
      }).`,
      'In order to run Prisma Client in an edge runtime, you will need to configure one of the following options:',
      '- Enable Driver Adapters: https://pris.ly/d/driver-adapters',
      '- Enable Accelerate: https://pris.ly/d/accelerate',
    ]

    throw new PrismaClientValidationError(message.join('\n'), {
      clientVersion: engineConfig.clientVersion,
    })
  }

  return TARGET_BUILD_TYPE satisfies never
}

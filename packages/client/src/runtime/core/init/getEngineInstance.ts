import { ClientEngineType, getClientEngineType, warnOnce } from '@prisma/internals'
import { detectRuntime } from 'detect-runtime'

import { GetPrismaClientConfig } from '../../getPrismaClient'
import { BinaryEngine, DataProxyEngine, EngineConfig, LibraryEngine } from '../engines'
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
export function getEngineInstance(clientConfig: GetPrismaClientConfig, engineConfig: EngineConfig) {
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

  if (clientConfig.noEngine !== true && url?.startsWith('prisma://')) {
    warnOnce(
      'recommend--no-engine',
      'In production, we recommend using `prisma generate --no-engine` (See: `prisma generate --help`)',
    )
  }

  const engineType = getClientEngineType(engineConfig.generator!)

  const useAccelerate = Boolean(url?.startsWith('prisma://') || clientConfig.noEngine)
  const useWasmEngine = Boolean(engineConfig.adapter)
  const useLibraryEngine = engineType === ClientEngineType.Library
  const useBinaryEngine = engineType === ClientEngineType.Binary

  if (useAccelerate && useWasmEngine) {
    let message: string[] | undefined

    if (clientConfig.noEngine) {
      message = [
        `Prisma Client was configured to use the \`adapter\` option but \`prisma generate\` was run with \`--no-engine\`.`,
        `Please run \`prisma generate\` without \`--no-engine\` to be able to use Prisma Client with the adapter.`,
      ]
    } else if (url?.startsWith('prisma://')) {
      message = [
        `Prisma Client was configured to use the \`adapter\` option but the URL was a \`prisma://\` URL.`,
        `Please either use the \`prisma://\` URL or remove the \`adapter\` from the Prisma Client constructor.`,
      ]
    } else {
      message = ['Prisma Client was configured to use both the `adapter` and Accelerate, please chose one.']
    }

    throw new PrismaClientValidationError(message.join('\n'), { clientVersion: engineConfig.clientVersion })
  }

  // TODO: one day we may want to completely deprecate `@prisma/client/edge` in favor of wasm build
  if (useAccelerate || TARGET_BUILD_TYPE === 'edge') return new DataProxyEngine(engineConfig)
  else if (useWasmEngine && TARGET_BUILD_TYPE === 'wasm') return new LibraryEngine(engineConfig)
  else if (useLibraryEngine && TARGET_BUILD_TYPE === 'library') return new LibraryEngine(engineConfig)
  else if (useBinaryEngine && TARGET_BUILD_TYPE === 'binary') return new BinaryEngine(engineConfig)

  // if either accelerate or wasm library could not be used, we throw an error
  if (TARGET_BUILD_TYPE === 'wasm') {
    const message = [
      `PrismaClient failed to initialize because it wasn't configured to run in this environment (${detectRuntime()}).`,
      'In order to run Prisma Client in an edge runtime, you will need to configure one of the following options:',
      '- Enable Driver Adapters: https://pris.ly/d/driver-adapters',
      '- Enable Accelerate: https://pris.ly/d/accelerate',
    ]

    throw new PrismaClientValidationError(message.join('\n'), {
      clientVersion: engineConfig.clientVersion,
    })
  }

  throw new PrismaClientValidationError('Invalid client engine type, please use `library` or `binary`', {
    clientVersion: engineConfig.clientVersion,
  })
}

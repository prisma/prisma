import { ClientEngineType, getClientEngineType, warnOnce } from '@prisma/internals'

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

  if (url?.startsWith('prisma://') || clientConfig.noEngine || TARGET_ENGINE_TYPE === 'edge') {
    return new DataProxyEngine(engineConfig)
  } else if (engineType === ClientEngineType.Library && TARGET_ENGINE_TYPE === 'library') {
    return new LibraryEngine(engineConfig)
  } else if (engineType === ClientEngineType.Binary && TARGET_ENGINE_TYPE === 'binary') {
    return new BinaryEngine(engineConfig)
  }

  throw new PrismaClientValidationError('Invalid client engine type, please use `library` or `binary`', {
    clientVersion: engineConfig.clientVersion,
  })
}

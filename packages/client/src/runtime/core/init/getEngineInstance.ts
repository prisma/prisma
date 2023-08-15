import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { BinaryEngine, DataProxyEngine, EngineConfig, LibraryEngine } from '../engines'
import { PrismaClientValidationError } from '../errors/PrismaClientValidationError'
import { resolveDatasourceUrl } from './resolveDatasourceUrl'

/**
 * Get the engine instance based on the engine type and the target engine type
 * (binary, library, data proxy). If the URL is a prisma:// URL, it will always
 * use the DataProxyEngine. Basically decides which engine to load.
 * @param _engineConfig
 * @returns
 */
export function getEngineInstance(_engineConfig: EngineConfig) {
  let url: string | undefined

  try {
    url = resolveDatasourceUrl({
      inlineDatasources: _engineConfig.inlineDatasources,
      overrideDatasources: _engineConfig.overrideDatasources,
      env: { ..._engineConfig.env, ...process.env },
      clientVersion: _engineConfig.clientVersion,
    })
  } catch {
    // the error does not matter, but that means we don't have a valid url which
    // means we can't use the DataProxyEngine and will default to LibraryEngine
  }

  const engineType = getClientEngineType(_engineConfig.generator!)

  if (url?.startsWith('prisma://') || TARGET_ENGINE_TYPE === 'edge') {
    return new DataProxyEngine(_engineConfig)
  } else if (engineType === ClientEngineType.Library && TARGET_ENGINE_TYPE === 'library') {
    return new LibraryEngine(_engineConfig)
  } else if (engineType === ClientEngineType.Binary && TARGET_ENGINE_TYPE === 'binary') {
    return new BinaryEngine(_engineConfig)
  }

  throw new PrismaClientValidationError('Invalid client engine type, please use `library` or `binary`', {
    clientVersion: _engineConfig.clientVersion,
  })
}

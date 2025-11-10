import { ActiveConnectorType, GeneratorConfig } from '@prisma/generator'

import { CompilerWasmLoadingConfig } from './QueryCompiler'
import { RuntimeDataModel } from './runtimeDataModel'

/**
 * Config that is stored into the generated client. When the generated client is
 * loaded, this same config is passed to {@link getPrismaClient} which creates a
 * closure with that config around a non-instantiated [[PrismaClient]].
 */
export type GetPrismaClientConfig = {
  // Case for normal client (with both protocols) or data proxy
  // client (with json protocol): only runtime datamodel is provided,
  // full DMMF document is not
  runtimeDataModel: RuntimeDataModel
  generator?: GeneratorConfig
  relativePath: string
  clientVersion: string
  engineVersion: string
  activeProvider: ActiveConnectorType

  /**
   * The contents of the schema encoded into a string
   * @remarks only used for the purpose of data proxy
   */
  inlineSchema: string

  /**
   * Optional wasm loading configuration
   */
  compilerWasm?: CompilerWasmLoadingConfig
}

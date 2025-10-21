import { ActiveConnectorType, EnvValue, GeneratorConfig } from '@prisma/generator'

import { CompilerWasmLoadingConfig } from './QueryCompiler'
import { EngineWasmLoadingConfig } from './QueryEngine'
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
  dirname: string
  clientVersion: string
  engineVersion: string
  datasourceNames: string[]
  activeProvider: ActiveConnectorType

  /**
   * The contents of the schema encoded into a string
   * @remarks only used for the purpose of data proxy
   */
  inlineSchema: string

  /**
   * A special env object just for the data proxy edge runtime.
   * Allows bundlers to inject their own env variables (Vercel).
   * Allows platforms to declare global variables as env (Workers).
   * @remarks only used for the purpose of data proxy
   */
  injectableEdgeEnv?: () => LoadedEnv

  /**
   * The contents of the datasource url saved in a string.
   * This can either be an env var name or connection string.
   * It is needed by the client to connect to the Data Proxy.
   * @remarks only used for the purpose of data proxy
   */
  inlineDatasources: { [name in string]: { url: EnvValue } }

  /**
   * The string hash that was produced for a given schema
   * @remarks only used for the purpose of data proxy
   */
  inlineSchemaHash: string

  /**
   * A marker to indicate that the client was not generated via `prisma
   * generate` but was generated via `generate --postinstall` script instead.
   * @remarks used to error for Vercel/Netlify for schema caching issues
   */
  postinstall?: boolean

  /**
   * Information about the CI where the Prisma Client has been generated. The
   * name of the CI environment is stored at generation time because CI
   * information is not always available at runtime. Moreover, the edge client
   * has no notion of environment variables, so this works around that.
   * @remarks used to error for Vercel/Netlify for schema caching issues
   */
  ciName?: string

  /**
   * Information about whether we have not found a schema.prisma file in the
   * default location, and that we fell back to finding the schema.prisma file
   * in the current working directory. This usually means it has been bundled.
   */
  isBundled?: boolean

  /**
   * A boolean that is `false` when the client was generated with --no-engine. At
   * runtime, this means the client will be bound to be using the Data Proxy.
   */
  copyEngine?: boolean

  /**
   * Optional wasm loading configuration
   */
  engineWasm?: EngineWasmLoadingConfig
  compilerWasm?: CompilerWasmLoadingConfig
}

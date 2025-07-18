import { bindMigrationAwareSqlAdapterFactory, Debug } from '@prisma/driver-adapter-utils'
import type { DeepMutable } from 'effect/Types'

import { defaultConfig } from './defaultConfig'
import type { PrismaConfig, PrismaConfigInternal } from './PrismaConfig'

export type { PrismaConfigInternal }

const debug = Debug('prisma:config:defineConfig')

/**
 * Define the configuration for the Prisma Development Kit.
 */
export function defineConfig(configInput: PrismaConfig): PrismaConfigInternal {
  /**
   * We temporarily treat config as mutable, to simplify the implementation of this function.
   */
  const config = defaultConfig()
  debug('[default]: %o', config)

  defineSchemaConfig(config, configInput)
  defineAdapterConfig(config, configInput)
  defineStudioConfig(config, configInput)
  defineMigrationsConfig(config, configInput)
  defineTablesConfig(config, configInput)
  defineTypedSqlConfig(config, configInput)
  defineViewsConfig(config, configInput)

  /**
   * We cast the type of `config` back to its original, deeply-nested
   * `Readonly` type
   */
  return config as PrismaConfigInternal
}

/**
 * `configInput.schema` is forwarded to `config.schema` as is.
 */
function defineSchemaConfig(config: DeepMutable<PrismaConfigInternal>, configInput: PrismaConfig) {
  if (!configInput.schema) {
    return
  }

  config.schema = configInput.schema
  debug('[config.schema]: %o', config.schema)
}

/**
 * `configInput.migrations` is forwarded to `config.migrations` as is.
 */
function defineMigrationsConfig(config: DeepMutable<PrismaConfigInternal>, configInput: PrismaConfig) {
  if (!configInput.migrations) {
    return
  }

  config.migrations = configInput.migrations
  debug('[config.migrations]: %o', config.migrations)
}

/**
 * `configInput.typedSql` is forwarded to `config.typedSql` as is.
 */
function defineTypedSqlConfig(config: DeepMutable<PrismaConfigInternal>, configInput: PrismaConfig) {
  if (!configInput.typedSql) {
    return
  }

  config.typedSql = configInput.typedSql
  debug('[config.typedSql]: %o', config.typedSql)
}

/**
 * `configInput.views` is forwarded to `config.views` as is.
 */
function defineViewsConfig(config: DeepMutable<PrismaConfigInternal>, configInput: PrismaConfig) {
  if (!configInput.views) {
    return
  }

  config.views = configInput.views
  debug('[config.views]: %o', config.views)
}

/**
 * `configInput.tables` is forwarded to `config.views` as is.
 */
function defineTablesConfig(config: DeepMutable<PrismaConfigInternal>, configInput: PrismaConfig) {
  if (!configInput.tables) {
    return
  }

  config.tables = configInput.tables
  debug('[config.tables]: %o', config.tables)
}

/**
 * `configInput.studio` is forwarded to `config.studio` as is.
 */
function defineStudioConfig(config: DeepMutable<PrismaConfigInternal>, configInput: PrismaConfig) {
  if (!configInput.studio?.adapter) {
    return
  }

  const { adapter: getAdapterFactory } = configInput.studio

  config.studio = {
    adapter: async () => {
      const adapterFactory = await getAdapterFactory()
      debug('[config.studio.adapter]: %o', adapterFactory.adapterName)
      return adapterFactory
    },
  }
  debug('[config.studio]: %o', config.studio)
}

/**
 * For `config.adapter`, we internally retrieve the `ErrorCapturingSqlMigrationAwareDriverAdapterFactory`
 * instance from the `SqlMigrationAwareDriverAdapterFactory` retrieved after invoking `configInput.adapter()`.
 */
function defineAdapterConfig(config: DeepMutable<PrismaConfigInternal>, configInput: PrismaConfig) {
  if (!configInput.adapter) {
    return
  }

  const { adapter: getAdapterFactory } = configInput

  config.adapter = async () => {
    const adapterFactory = await getAdapterFactory()
    debug('[config.adapter]: %o', adapterFactory.adapterName)
    return bindMigrationAwareSqlAdapterFactory(adapterFactory)
  }
  debug('[config.adapter]: %o', config.adapter)
}

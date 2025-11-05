import { makePrismaConfigInternal, type PrismaConfigInternal } from './PrismaConfig'

/**
 * This default config can be used as basis for unit and integration tests.
 */
export function defaultTestConfig(): PrismaConfigInternal {
  return makePrismaConfigInternal({
    loadedFromFile: null,
    datasource: {
      url: '<default_datasource_url>',
    },
  })
}

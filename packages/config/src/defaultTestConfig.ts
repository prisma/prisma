import { makePrismaConfigInternal, type PrismaConfigInternal } from './PrismaConfig'

/**
 * This default config can be used as basis for unit and integration tests.
 */
export function defaultTestConfig<Env = any>(): PrismaConfigInternal<Env> {
  return makePrismaConfigInternal<Env>({
    earlyAccess: true,
    loadedFromFile: null,
  })
}

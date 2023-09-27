export enum Providers {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  MONGODB = 'mongodb',
  COCKROACHDB = 'cockroachdb',
  SQLSERVER = 'sqlserver',
}

export enum ProviderFlavors {
  JS_PG = 'js_pg',
  JS_PLANETSCALE = 'js_planetscale',
  JS_NEON = 'js_neon',
  JS_LIBSQL = 'js_libsql',
  VITESS_8 = 'vitess_8',
}

export const flavorsForProvider = {
  [Providers.POSTGRESQL]: [ProviderFlavors.JS_PG, ProviderFlavors.JS_NEON],
  [Providers.MYSQL]: [ProviderFlavors.JS_PLANETSCALE],
  [Providers.SQLITE]: [ProviderFlavors.JS_LIBSQL],
  [Providers.MONGODB]: [],
  [Providers.COCKROACHDB]: [],
  [Providers.SQLSERVER]: [],
} as Record<Providers, ProviderFlavors[]>

export type AllProviders = { provider: Providers }[]

export const allProviders: AllProviders = Object.values(Providers).map((p) => ({ provider: p }))

export function isDriverAdapterProviderFlavor(flavor?: ProviderFlavors) {
  return Boolean(flavor?.startsWith('js_'))
}

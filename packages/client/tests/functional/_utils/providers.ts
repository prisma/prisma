export enum Providers {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  MONGODB = 'mongodb',
  COCKROACHDB = 'cockroachdb',
  SQLSERVER = 'sqlserver',
}

export enum AdapterProviders {
  JS_PG = 'js_pg',
  JS_PLANETSCALE = 'js_planetscale',
  JS_NEON = 'js_neon',
  JS_LIBSQL = 'js_libsql',
  JS_D1 = 'js_d1',

  // TODO: what to do with Vitess? It's not a driver adapter, but it's a flavor of MySQL.
  VITESS_8 = 'vitess_8',
}

export enum RelationModes {
  FOREIGN_KEYS = 'foreignKeys',
  PRISMA = 'prisma',
}

export const adaptersForProvider = {
  [Providers.POSTGRESQL]: [AdapterProviders.JS_PG, AdapterProviders.JS_NEON],
  [Providers.MYSQL]: [AdapterProviders.JS_PLANETSCALE],
  [Providers.SQLITE]: [AdapterProviders.JS_LIBSQL, AdapterProviders.JS_D1],
  [Providers.MONGODB]: [],
  [Providers.COCKROACHDB]: [],
  [Providers.SQLSERVER]: [],
} satisfies Record<Providers, AdapterProviders[]>

export const relationModesForAdapter = {
  [AdapterProviders.JS_PG]: undefined,
  [AdapterProviders.JS_PLANETSCALE]: RelationModes.PRISMA,
  [AdapterProviders.JS_NEON]: undefined,
  [AdapterProviders.JS_LIBSQL]: undefined,
  [AdapterProviders.JS_D1]: undefined,
  [AdapterProviders.VITESS_8]: RelationModes.PRISMA,
} satisfies Record<AdapterProviders, RelationModes | undefined>

export const allProviders = Object.values(Providers).map((p) => ({ provider: p }))

export const sqlProviders = allProviders.filter(({ provider }) => provider !== Providers.MONGODB)

export function isDriverAdapterProviderLabel(adapterProvider?: `${AdapterProviders}`) {
  return Boolean(adapterProvider?.startsWith('js_'))
}

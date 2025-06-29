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
  JS_BETTER_SQLITE3 = 'js_better_sqlite3',
  JS_MSSQL = 'js_mssql',
  JS_MARIADB = 'js_mariadb',

  // entries below are not driver adapters,
  // they are used for testing different databases
  JS_PG_COCKROACHDB = 'js_pg_cockroachdb',
  VITESS_8 = 'vitess_8',
}

export enum RelationModes {
  FOREIGN_KEYS = 'foreignKeys',
  PRISMA = 'prisma',
}

export type GeneratorTypes = 'prisma-client-js' | 'prisma-client-ts'

export const adaptersForProvider = {
  [Providers.POSTGRESQL]: [AdapterProviders.JS_PG, AdapterProviders.JS_NEON],
  [Providers.MYSQL]: [AdapterProviders.JS_PLANETSCALE, AdapterProviders.JS_MARIADB],
  [Providers.SQLITE]: [AdapterProviders.JS_LIBSQL, AdapterProviders.JS_D1, AdapterProviders.JS_BETTER_SQLITE3],
  [Providers.MONGODB]: [],
  [Providers.COCKROACHDB]: [AdapterProviders.JS_PG_COCKROACHDB],
  [Providers.SQLSERVER]: [AdapterProviders.JS_MSSQL],
} satisfies Record<Providers, AdapterProviders[]>

export const relationModesForAdapter = {
  [AdapterProviders.JS_PG]: undefined,
  [AdapterProviders.JS_PLANETSCALE]: RelationModes.PRISMA,
  [AdapterProviders.JS_NEON]: undefined,
  [AdapterProviders.JS_LIBSQL]: undefined,
  [AdapterProviders.JS_D1]: undefined,
  [AdapterProviders.JS_BETTER_SQLITE3]: undefined,
  [AdapterProviders.VITESS_8]: RelationModes.PRISMA,
  [AdapterProviders.JS_MSSQL]: undefined,
  [AdapterProviders.JS_MARIADB]: undefined,
  [AdapterProviders.JS_PG_COCKROACHDB]: undefined,
} satisfies Record<AdapterProviders, RelationModes | undefined>

export const allProviders = Object.values(Providers).map((p) => ({ provider: p }))

export const sqlProviders = allProviders.filter(({ provider }) => provider !== Providers.MONGODB)

export function isDriverAdapterProviderLabel(adapterProvider?: `${AdapterProviders}`) {
  return Boolean(adapterProvider?.startsWith('js_'))
}

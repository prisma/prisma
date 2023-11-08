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
  JS_MYSQL2 = 'js_mysql2',
}

export enum RelationModes {
  FOREIGN_KEYS = 'foreignKeys',
  PRISMA = 'prisma',
}

export const flavorsForProvider = {
  [Providers.POSTGRESQL]: [ProviderFlavors.JS_PG, ProviderFlavors.JS_NEON],
  [Providers.MYSQL]: [ProviderFlavors.JS_PLANETSCALE, ProviderFlavors.JS_MYSQL2],
  [Providers.SQLITE]: [ProviderFlavors.JS_LIBSQL],
  [Providers.MONGODB]: [],
  [Providers.COCKROACHDB]: [],
  [Providers.SQLSERVER]: [],
} as Record<Providers, ProviderFlavors[]>

export const relationModesForFlavor = {
  [ProviderFlavors.JS_PG]: undefined,
  [ProviderFlavors.JS_PLANETSCALE]: RelationModes.PRISMA,
  [ProviderFlavors.JS_NEON]: undefined,
  [ProviderFlavors.JS_LIBSQL]: undefined,
  [ProviderFlavors.VITESS_8]: RelationModes.PRISMA,
  [ProviderFlavors.JS_MYSQL2]: undefined,
} as Record<ProviderFlavors, RelationModes | undefined>

export const allProviders = Object.values(Providers).map((p) => ({ provider: p }))

export const sqlProviders = allProviders.filter(({ provider }) => provider !== Providers.MONGODB)

export function isDriverAdapterProviderFlavor(flavor?: ProviderFlavors) {
  return Boolean(flavor?.startsWith('js_'))
}

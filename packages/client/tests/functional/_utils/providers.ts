export enum Providers {
  SQLITE = 'sqlite',
  POSTGRESQL = 'postgresql',
  MYSQL = 'mysql',
  MONGODB = 'mongodb',
  COCKROACHDB = 'cockroachdb',
  SQLSERVER = 'sqlserver',
}

export type AllProviders = { provider: Providers }[]

export const allProviders: AllProviders = Object.values(Providers).map((p) => ({ provider: p }))

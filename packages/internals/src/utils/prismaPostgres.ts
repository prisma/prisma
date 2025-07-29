export const PRISMA_POSTGRES_PROVIDER = 'prisma+postgres'

export const PRISMA_POSTGRES_PROTOCOL = `${PRISMA_POSTGRES_PROVIDER}:`

declare const prismaPostgresBrand: unique symbol
declare const prismaPostgresDevBrand: unique symbol

export type PrismaPostgresUrl<T extends string | URL> = T & {
  readonly [prismaPostgresBrand]: true
}

export type PrismaPostgresDevUrl<T extends string | URL> = PrismaPostgresUrl<T> & {
  readonly [prismaPostgresDevBrand]: true
}

export function isPrismaPostgres<T extends string | URL>(
  connectionString?: T,
): connectionString is PrismaPostgresUrl<T> {
  return connectionString?.toString().startsWith(`${PRISMA_POSTGRES_PROTOCOL}//`) ?? false
}

export function isPrismaPostgresDev<T extends string | URL>(
  connectionString?: T,
): connectionString is PrismaPostgresDevUrl<T> {
  if (!isPrismaPostgres(connectionString)) {
    return false
  }

  const { host } = new URL(connectionString)

  return host.includes('localhost') || host.includes('127.0.0.1') || host.includes('[::1]')
}

export const PRISMA_POSTGRES_PROVIDER = 'prisma+postgres'

export const PRISMA_POSTGRES_PROTOCOL = `${PRISMA_POSTGRES_PROVIDER}:`

export function isPrismaPostgres(connectionString?: string | URL): connectionString is string | URL {
  return connectionString?.toString().startsWith(`${PRISMA_POSTGRES_PROTOCOL}//`) ?? false
}

export function isPrismaPostgresDev(connectionString?: string | URL): connectionString is string | URL {
  if (!isPrismaPostgres(connectionString)) {
    return false
  }

  const { host } = new URL(connectionString)

  return host.includes('localhost') || host.includes('127.0.0.1')
}

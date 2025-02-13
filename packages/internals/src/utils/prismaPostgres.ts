export const PRISMA_POSTGRES_PROVIDER = 'prisma+postgres'

export const PRISMA_POSTGRES_PROTOCOL = `${PRISMA_POSTGRES_PROVIDER}:`

export function isPrismaPostgres(connectionString?: string) {
  return connectionString?.startsWith(`${PRISMA_POSTGRES_PROTOCOL}//`) ?? false
}

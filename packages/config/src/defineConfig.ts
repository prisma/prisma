import type { DriverAdapter as QueryableDriverAdapter} from '@prisma/driver-adapter-utils'
import { createDriver as createLibSQLDriver, type LibSQLDriverInput } from '@prisma/adapter-libsql'
import { createDriver as createPgDriver, type PgDriverInput } from '@prisma/adapter-pg'

type PrismaConfigInputDriver<Env> =
  | {
    name: 'libsql'
    from: (env: Env) => Promise<LibSQLDriverInput>
  }
  | {
    name: 'pg'
    from: (env: Env) => Promise<PgDriverInput>
  }

export type PrismaConfig = {
  studio: {
    adapter: {
      name: string
      create: (env: any) => Promise<QueryableDriverAdapter>
    }
  }
}

export function defineConfig<Env>(configInput: PrismaConfigInputDriver<Env>): PrismaConfig {
  return {
    studio: {
      adapter: {
        name: configInput.name,
        create: async (env: Env) => {
          switch (configInput.name) {
            case 'libsql':
              const libsql = await configInput.from(env)
              return createLibSQLDriver(libsql)
            case 'pg':
              const pg = await configInput.from(env)
              return createPgDriver(pg)
          }
        }
      }
    }
  }
}

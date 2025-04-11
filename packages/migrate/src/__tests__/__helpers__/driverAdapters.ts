import { PrismaLibSQL } from '@prisma/adapter-libsql'
import { Provider, SqlMigrationAwareDriverAdapterFactory } from '@prisma/driver-adapter-utils'

type DriverAdapterTestConfig = {
  provider: Provider
  adapter: () => Promise<SqlMigrationAwareDriverAdapterFactory>
}

const driverAdapters: Record<string, DriverAdapterTestConfig> = {
  libsql: {
    provider: 'sqlite',
    adapter: () => {
      return Promise.resolve(
        new PrismaLibSQL({
          url: process.env.DATABASE_URL!,
        }),
      )
    },
  },
}

export default driverAdapters

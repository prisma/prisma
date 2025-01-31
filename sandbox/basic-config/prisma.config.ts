import type { DriverAdapter } from '@prisma/driver-adapter-utils'
import pg from 'pg'
import ws from 'ws'
import neon from '@neondatabase/serverless'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaNeon } from '@prisma/adapter-neon'

import type { Env } from './env'

type DriverAdapterConfig<EnvDictionary extends { [key: string]: string }> = {
  /**
   * A name that uniquely identifies a driver adapter.
   */
  name: '' | (string & {})

  /**
   * Factory function that creates a new instance of the driver adapter.
   * @param env Dictionary of environment variables.
   */
  create: (env: EnvDictionary) => Promise<DriverAdapter>
}

type DriversDeclaration<
  EnvDictionary extends { [key: string]: string },
  D extends readonly DriverAdapterConfig<EnvDictionary>[] = readonly DriverAdapterConfig<EnvDictionary>[]
> = {
  drivers: D
}

type ExtractDriverNames<
  EnvDictionary extends { [key: string]: string }, 
  T extends DriversDeclaration<EnvDictionary>,
> = T['drivers'][number]['name']

type PrismaCoreConfig<
  EnvDictionary extends { [key: string]: string },
  DriversDeclarationDefn extends DriversDeclaration<EnvDictionary>
> = {
  client: {
    adapter: ExtractDriverNames<EnvDictionary, DriversDeclarationDefn>
  },
  seed?: {
    adapter: ExtractDriverNames<EnvDictionary, DriversDeclarationDefn>
  },
  studio?: {
    adapter: ExtractDriverNames<EnvDictionary, DriversDeclarationDefn>
  },
  schemaEngine?: (
    {
      adapter: ExtractDriverNames<EnvDictionary, DriversDeclarationDefn>
    } |
    {
      adapters: ExtractDriverNames<EnvDictionary, DriversDeclarationDefn>[] // TODO: restrict to tuple of maximum size 2
    }
  ),
}

type DefinePrismaConfig<EnvDictionary extends { [key: string]: string }> = 
  <D extends readonly DriverAdapterConfig<EnvDictionary>[]>(
    step1Config: DriversDeclaration<EnvDictionary, D>
  ) => (
    step2Config: PrismaCoreConfig<EnvDictionary, DriversDeclaration<EnvDictionary, D>>
  ) => (env: EnvDictionary) => Promise<{
    client: {
      adapter: DriverAdapter
    }
  }>

const definePrismaConfig: DefinePrismaConfig<Env> = (driversConfig) => (prismaConfig) => async (env) => {
  // Retrieve the factory function for the Driver Adapter referenced by the `client` key in the Prisma config.
  const createClientAdapter = driversConfig.drivers
    .find(driver => driver.name === prismaConfig.client.adapter)!
    .create

  // Realise the configuration object for the Prisma Client.
  return {
    client: {
      adapter: await createClientAdapter(env)
    },
    // TODO: add instantiations for seed, studio, and migrations
  }
}

export default definePrismaConfig({
  drivers: [
	  {
	    // unique label
	    name: 'pg',
	    // factory function with access to external env
	    create: async (env) => {
	      const pool = new pg.Pool({
	        connectionString: env.PG_DATABASE_URL,
	      })
	      return new PrismaPg(pool)
	    }
	  },
	  {
	    name: 'neon:ws',
	    create: async (env) => {
	      neon.neonConfig.webSocketConstructor = ws
	      const pool = new neon.Pool({
	        connectionString: env.NEON_DATABASE_URL,
	      })
	      return new PrismaNeon(pool)
	    }
	  }
  ],
})({
  // @prisma/client config
  client: {
    adapter: 'pg',
  }, 
  // `prisma db`, `prisma migrate` commands config
  schemaEngine: {
    // If two adapters are declared, the first adapter is used by default.
    // To use the second adapter, specify it explicitly via a new `--adapter` argument,
    // which refers to the adapter's unique label.
    // 
    // Example: `prisma migrate dev --adapter=neon:ws`
    adapters: ['pg', 'neon:ws'],
  },
  // TODO: define location for `schema.prisma`:
  // schema: './prisma/schema.prisma',
})

import { defineConfig } from '@prisma/config'

export default defineConfig({
  experimental: {
    externalTables: true,
  },
  tables: {
    external: ['public.users'],
  },
  enums: {
    external: ['public.role'],
  },
  migrations: {
    // setup the users table for the shadow database
    initShadowDb: `
      CREATE TABLE public.users (id SERIAL PRIMARY KEY);
    `,
  },
})

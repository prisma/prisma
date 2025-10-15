import { defineConfig } from '@prisma/config'
export default defineConfig({
  datasource: {
    url: process.env.TEST_E2E_POSTGRES_URI,
  },
  engine: 'classic',
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

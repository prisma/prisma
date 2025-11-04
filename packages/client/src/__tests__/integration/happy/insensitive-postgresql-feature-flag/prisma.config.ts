import { defineConfig } from '@prisma/config'

const connectionString = process.env.TEST_POSTGRES_URI!.replace('tests', 'tests-insensitive-postgresql-feature-flag')

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: connectionString,
  },
})

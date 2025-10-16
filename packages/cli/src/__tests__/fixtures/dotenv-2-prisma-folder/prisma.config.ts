import { defineConfig, env } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: env('DOTENV_PRISMA_SHOULD_WORK'),
  },
})

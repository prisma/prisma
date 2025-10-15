import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: process.env.DOTENV_ROOT_PRISMA_SHOULD_WORK,
  },
})

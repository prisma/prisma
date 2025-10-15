import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: 'postgresql://this-should-not-be-used',
  },
})

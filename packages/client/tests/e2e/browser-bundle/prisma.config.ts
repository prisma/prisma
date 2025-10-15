import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    url: 'postgresql://user@pwd:example.com/db',
  },
})

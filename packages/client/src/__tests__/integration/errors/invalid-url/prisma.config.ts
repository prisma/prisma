import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: 'postgres://foo:bar@example:5432/database?pool_timeout=foo',
  },
})

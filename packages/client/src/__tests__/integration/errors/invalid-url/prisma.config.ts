import { defineConfig } from '@prisma/config'

export default defineConfig({
  engine: 'classic',
  datasource: {
    // validation should fail because of the `foo` value of `pool_timeout`, which is not valid
    url: 'postgres://foo:bar@example:5432/database?pool_timeout=foo',
  },
})

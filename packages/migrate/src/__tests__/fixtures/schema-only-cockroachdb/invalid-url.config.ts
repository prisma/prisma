import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: 'postgres://user:password@cockroach.invalid:26257/clustername.defaultdb?sslmode=verify-full&sslrootcert=$HOME/.postgresql/root.crt&options=--cluster%3Dclustername',
  },
  schema: './prisma/invalid-url.prisma',
})

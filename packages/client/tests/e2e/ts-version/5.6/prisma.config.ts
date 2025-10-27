// FIXME: `defineConfig` is broken with TypeScript 5.4–5.6
// import { defineConfig } from 'prisma/config'

export default {
  engine: 'classic',
  datasource: {
    url: 'file:./db',
  },
}

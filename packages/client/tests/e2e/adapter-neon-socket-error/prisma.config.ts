import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: 'postgresql://user:pass@localhost:1/nonexistent',
  },
})

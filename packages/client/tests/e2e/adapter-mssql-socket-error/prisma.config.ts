import { defineConfig } from 'prisma/config'

export default defineConfig({
  datasource: {
    url: 'sqlserver://localhost:1;database=nonexistent;user=sa;password=pass',
  },
})

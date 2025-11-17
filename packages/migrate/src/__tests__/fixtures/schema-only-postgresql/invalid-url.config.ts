import { defineConfig } from '@prisma/config'

export default defineConfig({
  datasource: {
    url: 'postgresql://johndoe:randompassword@doesnotexist:5432/mydb?schema=public',
  },
  schema: './prisma/invalid-url.prisma',
})

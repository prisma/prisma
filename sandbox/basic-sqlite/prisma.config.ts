import 'dotenv/config'
import { defineConfig } from 'prisma/config'

export default defineConfig({
  earlyAccess: true,
  schema: './prisma/schema.prisma',
  migrate: {
    // @ts-ignore
    adapter: async () => {
      return {
        
      }
    },
  }
})

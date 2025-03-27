import path from 'node:path'
import { defineConfig } from 'prisma/config'
import { PrismaD1HTTP } from '@prisma/adapter-d1'
import 'dotenv/config'

type Env = {
  CLOUDFLARE_D1_TOKEN: string
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_DATABASE_ID: string
}

export default defineConfig<Env>({
  earlyAccess: true,
  schema: path.join('custom', 'prisma', 'schema.prisma'),
  migrate: {
    async adapter(env) {
      return new PrismaD1HTTP({
        CLOUDFLARE_D1_TOKEN: env.CLOUDFLARE_D1_TOKEN,
        CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_DATABASE_ID: env.CLOUDFLARE_DATABASE_ID,
      })
    },
  }
})

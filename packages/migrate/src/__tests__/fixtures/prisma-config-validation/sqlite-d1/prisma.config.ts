import path from 'node:path'
import { defineConfig } from '@prisma/config'
import { PrismaD1HTTP } from '@prisma/adapter-d1'

type Env = {
  CLOUDFLARE_D1_TOKEN: string
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_DATABASE_ID: string
}

const env = {
  CLOUDFLARE_D1_TOKEN: '$CLOUDFLARE_D1_TOKEN',
  CLOUDFLARE_ACCOUNT_ID: '$CLOUDFLARE_ACCOUNT_ID',
  CLOUDFLARE_DATABASE_ID: '$CLOUDFLARE_DATABASE_ID',
} satisfies Env

export default defineConfig<Env>({
  earlyAccess: true,
  schema: path.join('schema.prisma'),
  migrate: {
    async adapter(_) {
      return new PrismaD1HTTP({
        CLOUDFLARE_D1_TOKEN: env.CLOUDFLARE_D1_TOKEN,
        CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
        CLOUDFLARE_DATABASE_ID: env.CLOUDFLARE_DATABASE_ID,
      })
    },
  },
})

import { defineConfig } from 'prisma/config'
import { PrismaD1 } from '@prisma/adapter-d1'
import 'dotenv/config'

type Env = {
  CLOUDFLARE_D1_TOKEN: string
  CLOUDFLARE_ACCOUNT_ID: string
  CLOUDFLARE_DATABASE_ID: string
}

const env = process.env as Env

export default defineConfig({
  experimental: {
    adapter: true,
  },
  async adapter() {
    return new PrismaD1({
      CLOUDFLARE_D1_TOKEN: env.CLOUDFLARE_D1_TOKEN,
      CLOUDFLARE_ACCOUNT_ID: env.CLOUDFLARE_ACCOUNT_ID,
      CLOUDFLARE_DATABASE_ID: env.CLOUDFLARE_DATABASE_ID,
    })
  },
})

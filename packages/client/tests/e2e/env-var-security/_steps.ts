import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

const DATABASE_URL = 'file:./secret-database-url-env-var-value.db'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec tsc --noEmit tests/index.ts`
  },
  test: async () => {
    await $`DATABASE_URL=${DATABASE_URL} pnpm prisma generate`
    await $`pnpm exec jest` // check output of generate
    await $`DATABASE_URL=${DATABASE_URL} pnpm prisma migrate dev --name init`
    await $`pnpm exec jest` // check output of generate through migrate (did differ due to env vars handling differences!)
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})

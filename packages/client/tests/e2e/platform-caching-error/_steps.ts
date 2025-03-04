/* eslint-disable @typescript-eslint/require-await */
import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    process.env.PRISMA_SKIP_POSTINSTALL_GENERATE = undefined
  },
  test: async () => {
      // fake the vercel ci environment
      process.env.VERCEL = '1'

      // this will trigger auto generate
      await $`npm install`

      process.env.VERCEL = undefined
      await $`pnpm exec jest vercel-auto-generate`
      // fake the vercel ci environment
      process.env.VERCEL = '1'

      // this will trigger manual generate
      await $`npx prisma generate`

      process.env.VERCEL = undefined
      await $`pnpm exec jest vercel-manual-generate`
  },
  finish: async () => {},
})

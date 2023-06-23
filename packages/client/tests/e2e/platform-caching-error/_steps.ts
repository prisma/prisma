import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {},
  test: async () => {
    // vercel + auto generate = error
    {
      // fake the vercel ci environment
      process.env.VERCEL = '1'

      // this will trigger auto generate
      await $`npm install`

      delete process.env.VERCEL
      await $`pnpm exec jest vercel-auto-generate`
    }
    // vercel + manual generate = no error
    {
      // fake the vercel ci environment
      process.env.VERCEL = '1'

      // this will trigger manual generate
      await $`npx prisma generate`

      delete process.env.VERCEL
      await $`pnpm exec jest vercel-manual-generate`
    }
  },
  finish: async () => {},
})

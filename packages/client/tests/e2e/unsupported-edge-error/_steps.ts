import { $, sleep } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const wrangler = $`pnpm wrangler dev`.nothrow()

    await sleep('1s')

    await $`pnpm exec jest`

    await wrangler.kill()
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})

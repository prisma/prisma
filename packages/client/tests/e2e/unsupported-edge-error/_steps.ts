import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const wrangler = $`pnpm wrangler dev`.nothrow()

    for await (const line of wrangler.stdout) {
      if (line.includes('http://127.0.0.1:8787')) {
        break
      }
    }

    await $`pnpm exec jest`

    await wrangler.kill()
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})

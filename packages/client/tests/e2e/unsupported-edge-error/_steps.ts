import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const wrangler = $`pnpm wrangler dev`.nothrow()

    let data = ''
    for await (const chunk of wrangler.stdout) {
      data += chunk
      if (data.includes('Ready')) {
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

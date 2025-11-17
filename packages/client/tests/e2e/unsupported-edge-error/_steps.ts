import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const wrangler = $`pnpm wrangler dev --ip 127.0.0.1 --port 8787`.nothrow()

    // Merge stdout and stderr to catch "Ready" from either stream
    let data = ''
    const outputPromise = (async () => {
      for await (const chunk of wrangler.stdout) {
        data += chunk
        if (data.includes('Ready')) {
          return
        }
      }
    })()

    const errorPromise = (async () => {
      for await (const chunk of wrangler.stderr) {
        data += chunk
        if (data.includes('Ready')) {
          return
        }
      }
    })()

    // Wait for "Ready" from either stream
    await Promise.race([outputPromise, errorPromise])

    // Give wrangler a moment to fully stabilize after "Ready"
    await new Promise((resolve) => setTimeout(resolve, 1000))

    await $`pnpm exec jest`

    await wrangler.kill()
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})

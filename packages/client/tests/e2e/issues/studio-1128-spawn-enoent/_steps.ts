import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma db push --force-reset`
  },

  test: async () => {
    process.env.DEBUG = 'prisma:cli:studio'
    const studio = $`pnpm exec prisma studio`

    const timer = setTimeout(() => {
      throw new Error('"prisma studio" didn\'t request to open the browser')
    }, 30_000)

    for await (const output of studio.stderr) {
      // Exit as soon as xdg-open subprocess in studio either spawns or reports failure to spawn
      if (
        output.includes('requested to open the url http://localhost:5555') ||
        output.includes('failed to open the url http://localhost:5555 in browser')
      ) {
        clearTimeout(timer)
        await studio.nothrow().kill()
        return
      }
    }

    await studio
  },

  finish: async () => {
    await $`echo "done"`
  },
})

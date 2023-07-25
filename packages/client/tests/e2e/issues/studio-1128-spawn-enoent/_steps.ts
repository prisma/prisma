import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma db push --force-reset`
  },

  test: async () => {
    process.env.DEBUG = 'prisma:studio'
    const studio = $`pnpm exec prisma studio`

    for await (const output of studio.stderr) {
      // Exit as soon as xdg-open subprocess in studio either spawns or reports failure to spawn
      if (
        output.includes('requested to open the url http://localhost:5555') ||
        output.includes('failed to open the url http://localhost:5555 in browser')
      ) {
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

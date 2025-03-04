import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const { stdout } = await $`tsx src/index.ts`

    if (!stdout.includes('loaded @prisma/client')) {
      throw new Error('Expected to load @prisma/client')
    }
    console.log('Success!')
  },
  finish: async () => {
    await $`echo "done"`
  },
})

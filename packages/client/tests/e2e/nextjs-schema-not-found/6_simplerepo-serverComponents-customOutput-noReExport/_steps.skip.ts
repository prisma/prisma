import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'
import { testServerComponents } from '../_shared/test'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm exec prisma db push --force-reset`
    await $`pnpm exec next build`
  },
  test: async () => {
    await testServerComponents()
  },
  finish: async () => {},
})

import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'
import { retry } from '../_utils/retry'

void executeSteps({
  setup: async () => {
    await $`corepack enable`
    await $`cp original.package.json package.json`
  },
  test: async () => {
    await retry(async () => {
      try {
        await $`yarn`
      } catch (e) {
        await $`yarn cache clean`
        throw e
      }
    }, 3)
    await $`yarn prisma generate`
    await $`yarn add db@link:./prisma/client`
  },
  finish: async () => {
    await $`echo "done"`
  },
})

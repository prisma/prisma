import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`corepack enable`
    await $`cp original.package.json package.json`
  },
  test: async () => {
    await $`yarn cache clean`
    await $`yarn`
    await $`yarn prisma generate`
    await $`yarn add db@link:./prisma/client`
  },
  finish: async () => {
    await $`echo "done"`
  },
})

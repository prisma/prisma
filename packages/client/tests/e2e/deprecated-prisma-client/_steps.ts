import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate --schema prisma/custom-output.prisma`
    await $`pnpm prisma generate --schema prisma/default-output.prisma`
  },
  test: async () => {
    await $`pnpm test`
  },
  finish: async () => {
    await $`echo "done"`
  },
})

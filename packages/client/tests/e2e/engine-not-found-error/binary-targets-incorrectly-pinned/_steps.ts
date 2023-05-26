import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma db push --force-reset`
  },
  test: async () => {
    await $`pnpm prisma -v`

    await $`PRISMA_CLIENT_ENGINE_TYPE=library pnpm prisma generate`
    await $`rm -f ./prisma/client/libquery_engine*`
    await $`pnpm jest library`

    await $`PRISMA_CLIENT_ENGINE_TYPE=binary pnpm prisma generate`
    await $`rm -f ./prisma/client/query-engine*`
    await $`pnpm jest binary`
  },
  finish: async () => {
    await $`echo "done"`
  },
})

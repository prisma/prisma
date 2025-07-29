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

    /**
     * Contrary to the `-postgres` and `-mysql` tests, it is safe to run the scripts
     * via `tsx`. This is because `sqlite` doesn't need any "external" connections.
     */
    await $`tsx src/default.ts`.quiet()
    await $`tsx src/dep.ts`.quiet()
    await $`tsx src/no-dep.ts`.quiet()
    await $`tsx src/esm-only-pkgs/default.ts`.quiet()
    await $`tsx src/esm-only-pkgs/dep.ts`.quiet()
    await $`tsx src/esm-only-pkgs/no-dep.ts`.quiet()
  },
  finish: async () => {
    await $`echo "done"`
  },
})

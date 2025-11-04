import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  // TODO: use an adapter that can be actually connected to, upgrade to wrangler@latest and use a wrangler.jsonc file.
  test: async () => {
    // const wrangler = $`pnpm wrangler dev --ip 127.0.0.1 --port 8787`.nothrow()
    // let data = ''
    // for await (const chunk of wrangler.stdout) {
    //   data += chunk
    //   if (data.includes('Ready')) {
    //     break
    //   }
    // }
    // await new Promise((resolve) => setTimeout(resolve, 1000))
    // await $`pnpm exec jest`
    // await wrangler.kill()
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})

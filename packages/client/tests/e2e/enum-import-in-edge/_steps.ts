import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
  },
  test: async () => {
    const wranglerProcess = $`pnpm wrangler dev --ip 127.0.0.1 --port 8787 src/index.ts`.nothrow()

    // wait for the server to be fully ready
    for await (const line of wranglerProcess.stdout) {
      if (line.includes('Ready')) break
    }

    const { stdout } = await $`curl http://localhost:8787/ -s`.nothrow()

    const expected =
      '{"Role":{"USER":"USER","ADMIN":"ADMIN"},"ModelName":{"User":"User","Post":"Post","Profile":"Profile"}}'

    if (!stdout.includes(expected)) {
      throw new Error('Expected to fetch the enum values')
    }
    console.log('Success!')

    await wranglerProcess.kill()
  },
  finish: async () => {
    await $`echo "done"`
  },
})

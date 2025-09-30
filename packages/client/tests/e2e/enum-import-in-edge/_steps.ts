import timers from 'node:timers/promises'

import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

async function retry<A>(fn: () => Promise<A>, max: number, delay: number = 1000): Promise<A> {
  for (let i = 0; i < max; i++) {
    try {
      return await fn()
    } catch (e) {
      if (i === max - 1) throw e
    }
    await timers.setTimeout(delay)
  }
  throw 'Unreachable'
}

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

    const { stdout } = await retry(() => $`curl http://localhost:8787/ -s`, 3)

    const expected =
      '{"Role":{"USER":"USER","ADMIN":"ADMIN"},"ModelName":{"User":"User","Post":"Post","Profile":"Profile"}}'

    if (!stdout.includes(expected)) {
      throw new Error('Expected to fetch the enum values')
    } else {
      console.log('Success!')
    }

    await wranglerProcess.kill()
  },
  finish: async () => {
    await $`echo "done"`
  },
})

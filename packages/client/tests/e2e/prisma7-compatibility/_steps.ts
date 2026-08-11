import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'

import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`

    const helpOutput = (await $`pnpm exec prisma7 --help`).stdout
    assert.match(helpOutput, /\$ prisma7 init/)
    assert.doesNotMatch(helpOutput, /\$ prisma init/)

    const versionOutput = (await $`pnpm exec prisma7 --version`).stdout
    assert.match(versionOutput, /^prisma7\s+: 0\.0\.0$/m)
    assert.doesNotMatch(versionOutput, /^prisma\s+: 0\.0\.0$/m)

    const versionJson = JSON.parse((await $`pnpm exec prisma7 --version --json`).stdout) as Record<string, unknown>
    assert.equal(versionJson.prisma7, '0.0.0')
    assert.equal(versionJson.prisma, undefined)

    const zshCompletion = (await $`pnpm exec prisma7 complete zsh`).stdout
    assert.match(zshCompletion, /^#compdef prisma7$/m)
    assert.match(zshCompletion, /prisma7 complete --/)
    assert.doesNotMatch(zshCompletion, /^#compdef prisma$/m)
    assert.doesNotMatch(zshCompletion, /prisma complete --/)

    const initProjectDir = path.join(process.cwd(), 'init-project')
    await fs.mkdir(initProjectDir, { recursive: true })
    await fs.writeFile(path.join(initProjectDir, 'package.json'), '{"private":true}\n')

    const prisma7Bin = path.resolve('node_modules/.bin/prisma7')
    await $`cd ${initProjectDir} && ${prisma7Bin} init --datasource-provider sqlite --no-skills`

    const generatedConfig = await fs.readFile(path.join(initProjectDir, 'prisma.config.ts'), 'utf8')
    assert.match(generatedConfig, /from ["']prisma7\/config["']/)
    assert.doesNotMatch(generatedConfig, /from ["']prisma\/config["']/)

    await $`pnpm exec tsc --noEmit`
    await $`pnpm exec prisma7 generate`
    await $`pnpm exec prisma7 db push --force-reset`
  },
  test: async () => {
    await $`pnpm exec tsc --noEmit --module node16 --moduleResolution node16 --target es2022 smoke.ts`
    await $`tsx smoke.ts`
  },
  finish: async () => {
    await $`echo "done"`
  },
})

import fs from 'fs'
import path from 'path'
import { $ } from 'zx'

import { executeSteps } from '../../_utils/executeSteps'

function replaceNativeBinaryTarget() {
  const nativeBinaryTargetRegex = /\{\n *"fromEnvVar": null,\n *"value": ".*",\n *"native": true\n *\}/g
  const binaryTargetReplacement = `{ "fromEnvVar": null, "value": "netbsd", "native": true }`
  const generatedClientIndexPath = path.join(__dirname, 'prisma', 'client', 'index.js')
  const generatedClientContents = fs.readFileSync(generatedClientIndexPath, 'utf-8')
  const newGeneratedClientContents = generatedClientContents.replace(nativeBinaryTargetRegex, binaryTargetReplacement)
  fs.writeFileSync(generatedClientIndexPath, newGeneratedClientContents)
}

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma db push --force-reset`
  },
  test: async () => {
    await $`pnpm prisma -v`

    await $`PRISMA_CLIENT_ENGINE_TYPE=library pnpm prisma generate`
    replaceNativeBinaryTarget()
    await $`rm -f ./prisma/client/libquery_engine*`
    await $`pnpm jest library`
  },
  finish: async () => {
    await $`echo "done"`
  },
})

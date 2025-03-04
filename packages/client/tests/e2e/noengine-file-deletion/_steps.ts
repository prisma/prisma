import fs from 'node:fs'
import path from 'node:path'
import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma db push`
  },
  test: async () => {
    // ensure that we already have an engine, as expected
    if ((await hasEngineFile()) === false) {
      throw new Error('libquery_engine-debian.so should be found')
    }

    // we change the schema to make sure that our unique naming of the generated
    // package json "name" field (via hash) does not interfere with the deletion
    await $`echo "// change the schema" >> ./prisma/schema.prisma`
    await $`pnpm prisma generate`

    // generate with no engine and ensure that it is gone
    await $`pnpm prisma generate --no-engine`

    if ((await hasEngineFile()) === true) {
      throw new Error('libquery_engine-debian.so should not be found')
    }

    // generate again without no engine and make a query
    await $`pnpm prisma generate`

    await $`pnpm jest`
  },
  finish: async () => {
    await $`echo "done"`
  },
})

async function hasEngineFile() {
  const prismaPath = path.dirname(
    require.resolve('.prisma/client', {
      paths: [path.dirname(require.resolve('@prisma/client'))],
    }),
  )

  const folderFilePaths = await fs.promises.readdir(prismaPath)

  return folderFilePaths.includes('libquery_engine-debian-openssl-3.0.x.so.node')
}

import { readdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

import { $ } from 'zx'

import { executeSteps } from '../_utils/executeSteps'

async function removeTsNoCheck(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true })

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      await removeTsNoCheck(fullPath)
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.ts')) {
        try {
          const content = await readFile(fullPath, 'utf-8')
          const newContent = content.replace(/\/\/ @ts-nocheck\n?/g, '')

          if (newContent !== content) {
            await writeFile(fullPath, newContent, 'utf-8')
          }
        } catch (error) {
          console.error(`Error processing file ${fullPath}:`, error)
        }
      }
    }
  }
}

void executeSteps({
  setup: async () => {
    await $`pnpm install`
    await $`pnpm prisma generate`
    await removeTsNoCheck('./client')
  },
  test: async () => {
    await $`pnpm tsc`
    await $`pnpm exec jest`
  },
  finish: async () => {
    await $`echo "done"`
  },
  // keep: true, // keep docker open to debug it
})

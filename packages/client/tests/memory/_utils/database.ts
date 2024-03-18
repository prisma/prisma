import { DbDrop, DbPush } from '@prisma/migrate'

import { MemoryTestDir } from './MemoryTestDir'

/**
 * Creates a database according to provided schema while silencing the output
 * @param testDir
 * @returns
 */
export async function setupMemoryTestDatabase(testDir: MemoryTestDir) {
  return withNoOutput(async () => {
    await DbPush.new().parse(['--schema', testDir.schemaFilePath, '--force-reset', '--skip-generate'])
  })
}

/**
 * Drops previously created database
 * @param testDir
 * @returns
 */
export async function dropMemoryTestDatabase(testDir: MemoryTestDir) {
  return withNoOutput(async () => {
    await DbDrop.new().parse(['--schema', testDir.schemaFilePath, '--force', '--preview-feature'])
  })
}

async function withNoOutput(callback: () => Promise<void>) {
  const originalInfo = console.info
  console.info = () => {}
  try {
    await callback()
  } finally {
    console.info = originalInfo
  }
}

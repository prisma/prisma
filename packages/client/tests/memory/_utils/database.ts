import { loadConfigFromFile, PrismaConfigInternal } from '@prisma/config'
import { DbDrop, DbPush } from '@prisma/migrate'

import { MemoryTestDir } from './MemoryTestDir'

/**
 * Creates a database according to provided schema while silencing the output
 * @param testDir
 * @returns
 */
export async function setupMemoryTestDatabase(testDir: MemoryTestDir) {
  const config = await getMemoryTestConfig(testDir)

  return withNoOutput(async () => {
    await DbPush.new().parse(['--force-reset'], config, testDir.basePath)
  })
}

/**
 * Drops previously created database
 * @param testDir
 * @returns
 */
export async function dropMemoryTestDatabase(testDir: MemoryTestDir) {
  const config = await getMemoryTestConfig(testDir)

  return withNoOutput(async () => {
    await DbDrop.new().parse(['--force', '--preview-feature'], config, testDir.basePath)
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

async function getMemoryTestConfig(testDir: MemoryTestDir): Promise<PrismaConfigInternal> {
  const { config, error } = await loadConfigFromFile({ configRoot: testDir.basePath })

  if (error || !config) {
    const reason = error?._tag ?? 'unknown error'
    throw new Error(`Failed to load prisma.config.ts for memory test ${testDir.testName} (${reason}).`)
  }

  return config
}

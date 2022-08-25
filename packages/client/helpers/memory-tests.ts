import { ClientEngineType, getClientEngineType } from '@prisma/internals'

import { runAllMemoryTests } from '../tests/memory/_utils/runAllMemoryTests'

if (getClientEngineType() === ClientEngineType.Binary) {
  console.log('Memory tests are skipped for binary engine at the moment')
  process.exit(0)
}

if (process.argv.length > 3) {
  console.error(`Usage: pnpm test:memory [filter]`)
  process.exit(1)
}

const filter = process.argv[2]

void runAllMemoryTests(filter)

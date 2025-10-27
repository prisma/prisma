import { runAllMemoryTests } from '../tests/memory/_utils/runAllMemoryTests'

if (process.argv.length > 3) {
  console.error(`Usage: pnpm test:memory [filter]`)
  process.exit(1)
}

const filter = process.argv[2]

void runAllMemoryTests(filter)

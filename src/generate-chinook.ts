import { generateClient } from './generation'
import { performance } from 'perf_hooks'
import { chinook } from './datamodels/chinook'
import path from 'path'

async function main() {
  console.clear()
  const before = performance.now()
  generateClient(
    chinook,
    path.join(__dirname, '../examples/chinook-example/prisma.yml'),
    path.join(__dirname, '../examples/chinook-example/@generated/prisma'),
  )
  const after = performance.now()
  console.log(`Generated client in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

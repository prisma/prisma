import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import path from 'path'
import { discourse } from '../src/fixtures/discourse'

async function main() {
  const before = performance.now()
  await generateClient(
    discourse,
    path.join(__dirname, './discourse/prisma.yml'),
    path.join(__dirname, './discourse/@generated/photon'),
    false,
    // '../../../../src/runtime',
  )
  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

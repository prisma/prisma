import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import path from 'path'
import { enums } from '../src/fixtures/enums'

async function main() {
  const before = performance.now()
  await generateClient(
    enums,
    path.join(__dirname, './enums/prisma.yml'),
    path.join(__dirname, './enums/@generated/photon'),
    false,
    '../../../../src/runtime',
  )
  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

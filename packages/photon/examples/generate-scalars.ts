import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import path from 'path'
import { scalars } from './datamodels/scalars'

async function main() {
  const before = performance.now()
  await generateClient(
    scalars,
    path.join(__dirname, './scalars/prisma.yml'),
    path.join(__dirname, './scalars/@generated/photon'),
    false,
    '../../../../src/runtime',
  )
  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

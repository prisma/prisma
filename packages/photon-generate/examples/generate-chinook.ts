import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import { chinook } from './datamodels/chinook'
import path from 'path'

async function main() {
  const before = performance.now()
  await generateClient(
    chinook,
    path.join(__dirname, './chinook/prisma.yml'),
    path.join(__dirname, './chinook/@generated/photon'),
    false,
  )
  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import path from 'path'
import { scalars } from './datamodels/scalars'

async function main() {
  const before = performance.now()
  await generateClient({
    datamodel: scalars,
    cwd: path.join(__dirname, './scalars/prisma.yml'),
    outputDir: path.join(__dirname, './scalars/@generated/photon'),
    transpile: false,
    runtimePath: '../../../../src/runtime',
  })
  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

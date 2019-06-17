import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import path from 'path'
import { blog } from '../src/fixtures/blog'

async function main() {
  const before = performance.now()
  await generateClient({
    datamodel: blog,
    cwd: path.join(__dirname, './blog/prisma.yml'),
    outputDir: path.join(__dirname, './blog/node_modules/@generated/photon'),
    transpile: true,
    // runtimePath: '../../../../src/runtime',
  })
  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

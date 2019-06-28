import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import path from 'path'
import fs from 'fs'
// import { blog } from '../src/fixtures/blog'

async function main() {
  const before = performance.now()
  const blog = fs.readFileSync(path.resolve(__dirname, './blog/project.prisma'), 'utf-8')
  await generateClient({
    datamodel: blog,
    cwd: path.join(__dirname, './blog/'),
    outputDir: path.join(__dirname, './blog/@generated/photon'),
    transpile: true,
    runtimePath: '../../../../src/runtime',
  })
  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

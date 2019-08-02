import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import path from 'path'
import fs from 'fs'
// import { blog } from '../src/fixtures/blog'

async function main() {
  const before = performance.now()
  const datamodelPath = path.resolve(__dirname, './blog/project.prisma')
  const blog = fs.readFileSync(datamodelPath, 'utf-8')
  // const platforms = ['native', 'linux-glibc-libssl1.1.0']
  const platforms = ['native']
  await generateClient({
    datamodelPath,
    datamodel: blog,
    cwd: path.join(__dirname, './blog/'),
    outputDir: path.join(__dirname, './blog/@generated/photon'),
    transpile: false,
    runtimePath: '../../../../src/runtime',
    platforms,
    generator: {
      config: {},
      name: 'photonjs',
      output: '/',
      provider: 'photonjs',
      platforms,
    },
  })
  const after = performance.now()
  console.log(`Generated Photon in ${(after - before).toFixed(3)}ms`)
}

main().catch(console.error)

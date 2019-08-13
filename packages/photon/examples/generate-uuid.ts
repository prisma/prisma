import { generateClient } from '../src/generation/generateClient'
import { performance } from 'perf_hooks'
import path from 'path'
import fs from 'fs'

async function main() {
  const before = performance.now()
  const datamodelPath = path.resolve(__dirname, './uuid/schema.prisma')
  const datamodel = fs.readFileSync(datamodelPath, 'utf-8')
  const platforms = ['native']
  await generateClient({
    datamodelPath,
    datamodel,
    cwd: path.join(__dirname, './uuid/'),
    outputDir: path.join(__dirname, './uuid/@generated/photon'),
    runtimePath: '../../../../src/runtime',
    transpile: false,
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

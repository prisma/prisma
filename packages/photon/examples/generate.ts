import fs from 'fs'
import { generateInFolder } from '../src/utils/generateInFolder'

async function main() {
  const projectDir = process.argv[2]
  if (!projectDir) {
    throw new Error(`Project dir missing. Usage: ts-node examples/generate.ts examples/accounts`)
  }
  if (!fs.existsSync(projectDir)) {
    throw new Error(`Path ${projectDir} does not exist`)
  }

  const time = await generateInFolder({ projectDir, useLocalRuntime: true, transpile: false })

  console.log(`Generated Photon in ${time.toFixed(3)}ms`)
}

main().catch(console.error)

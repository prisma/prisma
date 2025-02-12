import fs from 'fs'
import path from 'path'

import { generateInFolder } from '../src/utils/generateInFolder'

async function main() {
  const projectDir = process.argv[2]

  if (!projectDir) {
    throw new Error(`Project dir missing. Usage: ts-node examples/generate.ts examples/accounts`)
  }

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Path ${projectDir} does not exist`)
  }

  const time = await generateInFolder({
    projectDir: path.join(process.cwd(), projectDir),
  })

  console.log(`Generated Prisma Client in ${time.toFixed(3)}ms`)
}

main().catch(console.error)

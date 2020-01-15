import fs from 'fs'
import { generateInFolder } from '../src/utils/generateInFolder'
import arg from 'arg'
import chalk from 'chalk'

async function main() {
  const args = arg({
    '--skip-transpile': Boolean,
  })

  const projectDir = args._[0]

  if (!projectDir) {
    throw new Error(
      `Project dir missing. Usage: ts-node examples/generate.ts examples/accounts`,
    )
  }

  if (!fs.existsSync(projectDir)) {
    throw new Error(`Path ${projectDir} does not exist`)
  }

  const useLocalRuntime = args['--skip-transpile']

  const time = await generateInFolder({
    projectDir,
    useLocalRuntime,
    transpile: !args['--skip-transpile'],
  })

  console.log(
    `Generated Prisma Client ${chalk.underline(
      useLocalRuntime ? 'with' : 'without',
    )} local runtime in ${time.toFixed(3)}ms`,
  )
}

main().catch(console.error)

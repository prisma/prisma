import fs from 'fs'
import { generateInFolder } from '../src/utils/generateInFolder'
import arg from 'arg'
import chalk from 'chalk'
import path from 'path'

async function main() {
  const args = arg(
    {
      '--skip-transpile': Boolean,
      '--built-runtime': Boolean,
    },
  )

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

  if (args['--built-runtime'] && !args['--skip-transpile']) {
    throw new Error(
      `Please either provide --skip-transpile or --skip-transpile and --built-runtime`,
    )
  }

  const time = await generateInFolder({
    projectDir,
    useLocalRuntime: args['--skip-transpile'],
    transpile: !args['--skip-transpile'],
    useBuiltRuntime: args['--built-runtime'],
  })

  console.log(
    `Generated Prisma Client ${chalk.underline(
      useLocalRuntime ? 'with' : 'without',
    )} local runtime in ${time.toFixed(3)}ms`,
  )
}

main().catch(console.error)

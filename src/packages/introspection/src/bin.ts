#!/usr/bin/env ts-node

process.on('uncaughtException', (e) => {
  console.log(e)
})
process.on('unhandledRejection', (e, promise) => {
  console.log(String(e), String(promise))
})

import { isError, arg, tryLoadEnv } from '@prisma/sdk'

// Parse CLI arguments
const args = arg(
  process.argv.slice(2),
  {
    '--schema': String,
    '--telemetry-information': String,
  },
  false,
  true,
)

//
// Read .env file only if next to schema.prisma
//
// if the CLI is called without any command like `init`, `introspect` we can ignore .env loading
if (process.argv.length > 2) {
  tryLoadEnv(args)
}

/**
 * Dependencies
 */
import { Init } from './commands/Init'
import { Introspect } from './commands/Introspect'

/**
 * Main function
 */
async function main(): Promise<number> {
  process.env.NODE_ENV = 'production'
  // create a new CLI with our subcommands
  const args = arg(process.argv.slice(2), {})

  if (isError(args)) {
    console.error(args.message)
    return 1
  }

  const commands = {
    init: Init.new(),
    introspect: Introspect.new(),
  }

  if (commands[args._[0]]) {
    const result = await commands[args._[0]].parse(process.argv.slice(3))
    console.log(result)
  } else {
    console.error(
      `Command not found: ${args._[0]}. Available commands: ${Object.keys(
        commands,
      ).join(', ')}`,
    )
    return 1
  }

  return 0
}
/**
 * Run our program
 */
main()
  .then((code) => {
    if (code !== 0) {
      process.exit(code)
    }
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })

process.on('unhandledRejection', (e) => {
  console.error(e)
})

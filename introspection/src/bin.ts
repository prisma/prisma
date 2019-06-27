#!/usr/bin/env ts-node

/**
 * Dependencies
 */
import { isError, HelpError, Env } from '@prisma/cli'
import { Init } from './commands/Init'

/**
 * Main function
 */
async function main(): Promise<number> {
  // load the environment
  const env = await Env.load(process.env, process.cwd())
  if (isError(env)) {
    console.error(env)
    return 1
  }
  // create a new CLI with our subcommands
  const cli = Init.new(env)
  // parse the arguments
  const result = await cli.parse(process.argv.slice(2))
  if (result instanceof HelpError) {
    console.error(result)
    return 1
  } else if (isError(result)) {
    console.error(result)
    return 1
  }
  console.log(result)

  return 0
}
/**
 * Run our program
 */
main()
  .then(code => {
    if (code !== 0) {
      process.exit(code)
    }
  })
  .catch(err => {
    console.error(err)
    process.exit(1)
  })

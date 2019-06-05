#!/usr/bin/env ts-node

/**
 * Dependencies
 */
import { isError, HelpError, Env } from '@prisma/cli'
import { LiftCommand } from './cli/commands/LiftCommand'
import { LiftCreate } from './cli/commands/LiftCreate'
import { LiftUp } from './cli/commands/LiftUp'
import { LiftDown } from './cli/commands/LiftDown'
import { LiftWatch } from './cli/commands/LiftWatch'

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
  const cli = LiftCommand.new(
    {
      create: LiftCreate.new(env),
      up: LiftUp.new(env),
      down: LiftDown.new(env),
      watch: LiftWatch.new(env),
    },
    env,
  )
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

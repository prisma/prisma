#!/usr/bin/env ts-node

/**
 * Dependencies
 */
import { isError, HelpError, Env, CompiledGeneratorDefinition } from '@prisma/cli'
import { LiftCommand } from './cli/commands/LiftCommand'
import { LiftSave } from './cli/commands/LiftSave'
import { LiftUp } from './cli/commands/LiftUp'
import { LiftDown } from './cli/commands/LiftDown'
import { LiftWatch } from './cli/commands/LiftWatch'
import { Converter } from '.'
import { generatorDefinition } from '@prisma/photon'
import path from 'path'
import { generateInThread } from './generateInThread'

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

  const generators: CompiledGeneratorDefinition[] = [
    {
      prettyName: generatorDefinition.prettyName,
      generate: () =>
        generateInThread({
          packagePath: '@prisma/photon',
          config: {
            cwd: env.cwd,
            generator: {
              config: {},
              name: 'photon',
              output: path.join(env.cwd, '/node_modules/@generated/photon'),
            },
            otherGenerators: [],
          },
        }),
    },
  ]

  // create a new CLI with our subcommands
  const cli = LiftCommand.new(
    {
      save: LiftSave.new(env),
      up: LiftUp.new(env),
      down: LiftDown.new(env),
      watch: LiftWatch.new(env, generators),
      convert: Converter.new(env),
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
process.on('SIGINT', () => {
  process.exit(1) // now the "exit" event will fire
})

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

import { bold, dim } from 'kleur/colors'
import path from 'path'

import { getClientEngineType } from '../client/getClientEngineType'
import type { Generator } from '../Generator'
import { formatms } from '../utils/formatms'
import { parseEnvValue } from '../utils/parseEnvValue'

/**
 * Creates and formats the success message for the given generator to print to
 * the console after generation finishes.
 * @param time time in milliseconds it took for the generator to run.
 */
export function getGeneratorSuccessMessage(generator: Generator, time: number): string {
  const name = generator.getPrettyName()
  const version = formatVersion(generator)
  const to = formatOutput(generator)
  return `✔ Generated ${bold(name)}${version ? ` (${version})` : ''}${to} in ${formatms(time)}`
}

function formatVersion(generator: Generator): string | undefined {
  const version = generator.manifest?.version

  if (generator.getProvider() === 'prisma-client-js') {
    const engineType = getClientEngineType(generator.config)
    const engineMode = generator.options?.dataProxy ? 'dataproxy' : engineType
    return version ? `${version} | ${engineMode}` : engineMode
  }

  return version
}

function formatOutput(generator: Generator): string {
  const output = generator.options?.generator.output
  return output ? dim(` to .${path.sep}${path.relative(process.cwd(), parseEnvValue(output))}`) : ''
}

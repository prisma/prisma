import { getGenerators, getGeneratorSuccessMessage } from '@prisma/client/generator-build'
import { enginesVersion } from '@prisma/engines-version'
import chalk from 'chalk'
import logUpdate from 'log-update'

const packageJson = eval(`require('../package.json')`)

type TryToRunGenerateInput = {
  schemaPath?: string
}

export async function tryToRunGenerate({ schemaPath }: TryToRunGenerateInput): Promise<void> {
  if (!schemaPath) throw new Error('this.schemaPath is undefined')

  const message: string[] = []

  console.info() // empty line
  logUpdate(`Running generate... ${chalk.dim('(Use --skip-generate to skip the generators)')}`)

  const generators = await getGenerators({
    schemaPath: schemaPath,
    printDownloadProgress: true,
    version: enginesVersion,
    cliVersion: packageJson.version,
    dataProxy: false,
  })

  for (const generator of generators) {
    logUpdate(`Running generate... - ${generator.getPrettyName()}`)

    const before = Date.now()
    try {
      await generator.generate()
      const after = Date.now()
      message.push(getGeneratorSuccessMessage(generator, after - before))
      generator.stop()
    } catch (e: any) {
      message.push(`${e.message}`)
      generator.stop()
    }
  }

  logUpdate(message.join('\n'))
}

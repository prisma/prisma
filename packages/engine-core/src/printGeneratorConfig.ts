import indent from 'indent-string'
import { GeneratorConfig } from '@prisma/cli'

export function printGeneratorConfig(config: GeneratorConfig): string {
  return String(new GeneratorConfigClass(config))
}

export class GeneratorConfigClass {
  constructor(private readonly config: GeneratorConfig) {}
  toString() {
    const { config } = this
    // parse & stringify trims out all the undefined values
    const obj = JSON.parse(
      JSON.stringify({
        provider: config.provider,
        platforms: config.platforms,
        pinnedPlatform: config.pinnedPlatform,
      }),
    )

    return `generator ${config.name} {
${indent(printDatamodelObject(obj), 2)}
}`
  }
}

export function printDatamodelObject(obj) {
  const maxLength = Object.keys(obj).reduce((max, curr) => Math.max(max, curr.length), 0)
  return Object.entries(obj)
    .map(([key, value]) => `${key.padEnd(maxLength)} = ${JSON.stringify(value)}`)
    .join('\n')
}

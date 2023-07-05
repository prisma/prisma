import type { BinaryTargetsEnvValue, GeneratorConfig } from '@prisma/generator-helper'
import indent from 'indent-string'

export function printGeneratorConfig(config: GeneratorConfig): string {
  return String(new GeneratorConfigClass(config))
}

export class GeneratorConfigClass {
  constructor(private readonly config: GeneratorConfig) {}
  toString(): string {
    const { config } = this
    // parse & stringify trims out all the undefined values

    const provider = config.provider.fromEnvVar ? `env("${config.provider.fromEnvVar}")` : config.provider.value

    const obj = JSON.parse(
      JSON.stringify({
        provider,
        binaryTargets: getOriginalBinaryTargetsValue(config.binaryTargets),
      }),
    )

    return `generator ${config.name} {
${indent(printDatamodelObject(obj), 2)}
}`
  }
}

export function getOriginalBinaryTargetsValue(binaryTargets: BinaryTargetsEnvValue[]) {
  let value: string | string[] | undefined
  if (binaryTargets.length > 0) {
    const binaryTargetsFromEnvVar = binaryTargets.find((object) => object.fromEnvVar !== null)
    if (binaryTargetsFromEnvVar) {
      value = `env("${binaryTargetsFromEnvVar.fromEnvVar}")`
    } else {
      value = binaryTargets.map((object) => (object.native ? 'native' : object.value))
    }
  } else {
    value = undefined
  }

  return value
}

export function printDatamodelObject(obj): string {
  const maxLength = Object.keys(obj).reduce((max, curr) => Math.max(max, curr.length), 0)
  return Object.entries(obj)
    .map(([key, value]) => `${key.padEnd(maxLength)} = ${niceStringify(value)}`)
    .join('\n')
}

function niceStringify(value): any {
  return JSON.parse(
    JSON.stringify(value, (_, value) => {
      if (Array.isArray(value)) {
        return `[${value.map((element) => JSON.stringify(element)).join(', ')}]`
      }
      return JSON.stringify(value)
    }),
  )
}

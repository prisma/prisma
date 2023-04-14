import { photonResolver } from './photonjs/photonResolver'
import { prismaClientResolver } from './prisma-client-js/prismaClientResolver'

export type GeneratorPaths = {
  outputPath: string
  generatorPath: string
  isNode?: boolean
}

export type GeneratorResolver = (baseDir: string, version?: string) => Promise<GeneratorPaths>

export type GeneratorResolvers = {
  [generatorName: string]: GeneratorResolver
}

/**
 * A map of generator names to their respective resolver functions. The resolver
 * functions are responsible for finding our default generators by their name,
 * as written in the schema, as well as finding their output paths.
 */
export const generatorResolvers: GeneratorResolvers = {
  photonjs: photonResolver,
  'prisma-client-js': prismaClientResolver,
}

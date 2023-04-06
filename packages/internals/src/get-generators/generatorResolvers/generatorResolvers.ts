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

export const generatorResolvers: GeneratorResolvers = {
  photonjs: photonResolver,
  'prisma-client-js': prismaClientResolver,
}

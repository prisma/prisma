import { Dictionary, GeneratorDefinitionWithPackage } from '@prisma/cli'
import { generatorDefinition as photonDefinition } from '@prisma/photon'
import { generatorDefinition as nexusPrismaDefinition } from 'nexus-prisma'
// import { generatorDefinition as prismaTestUtilsDefinition } from 'prisma-test-utils'

const photon: GeneratorDefinitionWithPackage = {
  packagePath: '@prisma/photon',
  definition: photonDefinition,
}

const nexusPrisma: GeneratorDefinitionWithPackage = {
  packagePath: 'nexus-prisma',
  definition: nexusPrismaDefinition,
}

// const prismaTestUtils: GeneratorDefinitionWithPackage = {
//   packagePath: 'prisma-test-utils',
//   definition: prismaTestUtilsDefinition,
// }

export const predefinedGenerators: Dictionary<GeneratorDefinitionWithPackage> = {
  photonjs: photon,
  'nexus-prisma': nexusPrisma,
  // 'prisma-test-utils': prismaTestUtils,
}

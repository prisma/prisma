import { PrismaClientJsGenerator } from '@prisma/client-generator-js'
import { PrismaClientTsGenerator } from '@prisma/client-generator-ts'

import { GeneratorRegistry } from './registry'

export const defaultRegistry = new GeneratorRegistry()

defaultRegistry.add(new PrismaClientJsGenerator())
defaultRegistry.add(new PrismaClientTsGenerator())

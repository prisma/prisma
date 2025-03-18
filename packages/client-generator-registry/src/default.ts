import { PrismaClientJsGenerator } from '@prisma/client-generator-js'

import { GeneratorRegistry } from './registry'

export const defaultRegistry = new GeneratorRegistry()

defaultRegistry.add(new PrismaClientJsGenerator())

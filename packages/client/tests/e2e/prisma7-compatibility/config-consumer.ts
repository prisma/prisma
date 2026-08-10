import { defineConfig, type PrismaConfig } from 'prisma7/config'

import config from './prisma.config'

const checkedConfig: PrismaConfig = config

void defineConfig(checkedConfig)

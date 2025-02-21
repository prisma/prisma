export { defaultConfig } from './defaultConfig'
export { defaultTestConfig } from './defaultTestConfig'
export { defineConfig } from './defineConfig'
export { type ConfigFromFile, loadConfigFromFile, type LoadConfigFromFileError } from './loadConfigFromFile'
export type { PrismaConfig, PrismaConfigInternal } from './PrismaConfig'

// This is needed to avoid ts(2742) when using `defineConfig` in prisma.config.ts.
export type { Brand } from 'effect/Brand'

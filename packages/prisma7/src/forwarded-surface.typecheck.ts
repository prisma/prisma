import type { PrismaConfig as RootPrismaConfig } from 'prisma'
import { defineConfig, env, type PrismaConfig as ConfigPrismaConfig, type PrismaConfigInternal } from 'prisma/config'

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <Value>() => Value extends Right ? 1 : 2 ? true : false
type Assert<Value extends true> = Value
type RootAndConfigTypesMatch = Assert<Equal<RootPrismaConfig, ConfigPrismaConfig>>
type ForwardedConfigExports = [typeof defineConfig, typeof env, PrismaConfigInternal]

type _ForwardedSurface = [RootAndConfigTypesMatch, ForwardedConfigExports]

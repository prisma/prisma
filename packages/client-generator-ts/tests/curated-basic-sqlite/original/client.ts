/**
 * This file should be your main import to use Prisma. Through it you get access to all the models, enums, and input types.
 *
 * 🟢 You can import this file directly.
 */

import * as process from 'node:process'
import * as path from 'node:path'

import * as $Enums from './enums.js'
import * as Prisma from './internal/prismaNamespace.js'

export * as $Enums from './enums.js'
export { PrismaClient } from './internal/class.js'
export { Prisma }

// file annotations for bundling tools to include these files
path.join(__dirname, 'libquery_engine-debian-openssl-1.1.x.so.node')
path.join(process.cwd(), 'generated/client/libquery_engine-debian-openssl-1.1.x.so.node')

/**
 * Model Link
 *
 */
export type Link = Prisma.LinkModel
/**
 * Model User
 *
 */
export type User = Prisma.UserModel

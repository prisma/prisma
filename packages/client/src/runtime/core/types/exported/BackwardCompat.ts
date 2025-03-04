/**
 * Workaround for some of the Accelerate versions.
 * It happens so that our type bundler renames types if the have conflicting names. Types
 * with the same name that come later get _N suffix.
 * We then make all bundled types public for performance reason. That also includes renamed types.
 * In turn, that allows tsc to inline any type into dependent project's definition. And that also includes
 * renamed types.
 * What happened is, accelerate got published with `Result_2` and `Args_3` types in it's declaration file.
 * See https://unpkg.com/@prisma/extension-accelerate@0.6.2/dist/esm/entry.node.d.ts
 *
 * In the future prisma version, order of the modules changed and `Result_2` alias no longer referred to the same type.
 * Adding this alias manually ensures older accelerate versions continue to work.
 */

import type { Args, Result } from './Public'
import type { Operation } from './Result'

export type Result_2<T, A, F extends Operation> = Result<T, A, F>
export type Args_3<T, F extends Operation> = Args<T, F>

// TODO: consider removing in Prisma 6

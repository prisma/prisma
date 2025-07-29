import * as ts from '@prisma/ts-builders'

// @ts-ignore This doesn't currently work at build time when we don't have the `paths` set in `tsconfig.json`.
// Adding `@prisma/client` as a dev dependency leads to circular dependency issues.
// TODO: figure out if we can reuse the runtime types without moving all of them to the common package.
// eslint-disable-next-line @typescript-eslint/no-redundant-type-constituents
type RuntimeExport = keyof typeof import('@prisma/client/runtime/library') & string

/**
 * Helps to ensure that when we want to refer to a type or value, imported from runtime Module
 * we are referring to the name, that is actually exported
 *
 * @param name imported name
 */
export function runtimeImport(name: RuntimeExport): string {
  return name
}

export function runtimeImportedType(name: RuntimeExport): ts.NamedType {
  return ts.namedType(`runtime.${name}`)
}

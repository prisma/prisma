type RuntimeExports = typeof import('../../runtime')

/**
 * Helps to unsure that when we want to refer to a type or value, imported from runtime Module
 * we are refering to the name, that is actually exported
 *
 * @param name imported name
 */
export function runtimeImport(name: keyof RuntimeExports): string {
  return name
}

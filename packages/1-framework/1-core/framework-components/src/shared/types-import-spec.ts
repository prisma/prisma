/**
 * Specifies how to import TypeScript types from a package.
 * Used in extension pack manifests to declare codec and operation type imports.
 */
export interface TypesImportSpec {
  readonly package: string;
  readonly named: string;
  readonly alias: string;
}

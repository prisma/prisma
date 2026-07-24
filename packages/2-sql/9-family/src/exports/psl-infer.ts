/**
 * Shape-neutral database→PSL inference utilities.
 *
 * These leaf transforms (name normalization, relation inference, generic
 * default mapping, the printer-config types, raw-default parsing) carry no
 * dialect knowledge, so they live in the SQL family and are imported by the
 * target that owns the dialect maps and walks its own schema tree (Postgres).
 * The framework owns `PslDocumentAst` + `printPsl`; the target owns the
 * Postgres type/default maps.
 */

export type {
  DefaultMappingOptions,
  DefaultMappingResult,
} from '../core/psl-contract-infer/default-mapping';
export { mapDefault } from '../core/psl-contract-infer/default-mapping';
export {
  deriveBackRelationFieldName,
  deriveRelationFieldName,
  pluralize,
  toEnumMemberName,
  toEnumName,
  toFieldName,
  toModelName,
} from '../core/psl-contract-infer/name-transforms';
export type {
  EnumInfo,
  PslPrinterOptions,
  PslTypeMap,
  PslTypeReference,
  PslTypeResolution,
  RelationField,
} from '../core/psl-contract-infer/printer-config';
export { parseRawDefault } from '../core/psl-contract-infer/raw-default-parser';
export type { InferredRelations } from '../core/psl-contract-infer/relation-inference';
export {
  buildChildRelationField,
  inferRelations,
} from '../core/psl-contract-infer/relation-inference';

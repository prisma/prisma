/**
 * ParamGraph: Compact schema for runtime parameterization.
 *
 * This data structure is generated from DMMF at client generation time
 * and embedded in the generated client. It enables schema-aware
 * parameterization where values are only parameterized when both schema
 * rules and runtime value types agree.
 */

/**
 * Compact schema embedded in the generated client.
 */
export type ParamGraph = {
  /**
   * String table to avoid repeating field names.
   * Field names are referenced by index throughout the graph.
   */
  s: string[]

  /**
   * User enum names for runtime membership checks.
   * Values are looked up via `runtimeDataModel.enums[enumName].values`.
   */
  en: string[]

  /**
   * Input nodes used for argument objects and input types.
   * Each node describes which fields are parameterizable or lead to
   * parameterizable descendants.
   */
  i: InputNode[]

  /**
   * Output nodes used for selection traversal.
   * Each node describes which fields have arguments or lead to
   * nested selections with arguments.
   */
  o: OutputNode[]

  /**
   * Root mapping: "Model.action" or "action" (for non-model ops).
   * Points to the args node (input) and root output node.
   */
  r: Record<string, RootEntry>
}

/**
 * Entry point for a root operation.
 */
export type RootEntry = {
  /** Args node id (into `i` array) */
  a?: NodeId
  /** Output node id (into `o` array) */
  o?: NodeId
}

/**
 * Node ID is an index into `i` or `o` array.
 */
export type NodeId = number

/**
 * Input node: describes parameterizable fields in an input object.
 * Only fields that are parameterizable or lead to parameterizable
 * descendants are present.
 */
export type InputNode = {
  /**
   * Map from string-table index to edge descriptor.
   * Omitted if the node has no fields (shouldn't happen in practice).
   */
  f?: Record<number, InputEdge>
}

/**
 * Output node: describes fields in a selection set that have args
 * or nested selections that may contain parameterizable args.
 */
export type OutputNode = {
  /**
   * Map from string-table index to edge descriptor.
   */
  f?: Record<number, OutputEdge>
}

/**
 * Edge descriptor for input fields.
 * Encodes what kinds of values the field accepts and how to handle them.
 */
export type InputEdge = {
  /**
   * Bit flags describing field capabilities.
   * See EdgeFlag enum below.
   */
  k: number

  /**
   * Child input node id (for object values or list of objects).
   * Present when the field accepts input object types.
   */
  c?: NodeId

  /**
   * Scalar type mask for allowed scalar categories.
   * Present when field accepts scalar values.
   * See ScalarMask enum below.
   */
  m?: number

  /**
   * Enum name id (index into `en` array).
   * Present when field accepts a user enum without a plain String scalar.
   * Used for runtime membership validation.
   */
  e?: number
}

/**
 * Edge descriptor for output fields.
 */
export type OutputEdge = {
  /** Args node for this field (if it accepts arguments) */
  a?: NodeId
  /** Next output node for nested selection traversal */
  o?: NodeId
}

/**
 * Bit flags for InputEdge.k describing what the field accepts.
 */
export const EdgeFlag = {
  /**
   * Field may be parameterized as a scalar value.
   * Check ScalarMask to validate the value type.
   */
  ParamScalar: 1,

  /**
   * Field accepts list-of-scalar values.
   * Parameterize the whole list if all elements match ScalarMask.
   */
  ListScalar: 2,

  /**
   * Field accepts list-of-object values.
   * Recurse into each element using the child node.
   */
  ListObject: 4,

  /**
   * Field accepts object values.
   * Recurse into child input node.
   */
  Object: 8,

  /**
   * Field accepts null as a valid value.
   * Note: Null values are NEVER parameterized at runtime regardless of this flag.
   * This flag is informational only (reflects isNullable from DMMF).
   */
  Nullable: 16,
} as const

export type EdgeFlagValue = (typeof EdgeFlag)[keyof typeof EdgeFlag]

/**
 * Bit mask for scalar type categories.
 * Used in InputEdge.m to validate runtime value types.
 */
export const ScalarMask = {
  String: 1,
  Number: 2, // Int, Float
  Boolean: 4,
  DateTime: 8,
  Decimal: 16,
  BigInt: 32,
  Bytes: 64,
  Json: 128,
} as const

export type ScalarMaskValue = (typeof ScalarMask)[keyof typeof ScalarMask]

/**
 * Helper function to check if an edge has a specific flag.
 */
export function hasFlag(edge: InputEdge, flag: number): boolean {
  return (edge.k & flag) !== 0
}

/**
 * Helper function to get the scalar mask from an edge.
 */
export function getScalarMask(edge: InputEdge): number {
  return edge.m ?? 0
}

/**
 * Maps DMMF scalar type names to ScalarMask values.
 */
export function scalarTypeToMask(typeName: string): number {
  switch (typeName) {
    case 'String':
      return ScalarMask.String
    case 'Int':
    case 'Float':
      return ScalarMask.Number
    case 'Boolean':
      return ScalarMask.Boolean
    case 'DateTime':
      return ScalarMask.DateTime
    case 'Decimal':
      return ScalarMask.Decimal
    case 'BigInt':
      return ScalarMask.BigInt
    case 'Bytes':
      return ScalarMask.Bytes
    case 'Json':
      return ScalarMask.Json
    default:
      return 0
  }
}

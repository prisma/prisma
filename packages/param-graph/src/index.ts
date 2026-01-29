// Main class and types
export type { EnumLookup, InputEdge, InputNode, OutputEdge, OutputNode, RootEntry } from './param-graph'
export { ParamGraph } from './param-graph'

// Data types for builder
export type {
  InputEdgeData,
  InputNodeData,
  OutputEdgeData,
  OutputNodeData,
  ParamGraphData,
  RootEntryData,
} from './param-graph'

// Constants and utilities
export type { EdgeFlagValue, ScalarMaskValue } from './param-graph'
export { EdgeFlag, getScalarMask, hasFlag, ScalarMask, scalarTypeToMask } from './param-graph'

// Serialization
export type { SerializedParamGraph } from './serialization'
export { deserializeParamGraph, serializeParamGraph } from './serialization'

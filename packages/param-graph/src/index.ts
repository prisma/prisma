// Main class and types
export { ParamGraph } from './param-graph'
export type { EnumLookup, InputEdge, InputNode, OutputEdge, OutputNode, RootEntry } from './param-graph'

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
export { EdgeFlag, getScalarMask, hasFlag, ScalarMask, scalarTypeToMask } from './param-graph'
export type { EdgeFlagValue, ScalarMaskValue } from './param-graph'

// Serialization
export { deserializeParamGraph, serializeParamGraph } from './serialization'
export type { SerializedParamGraph } from './serialization'

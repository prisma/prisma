/**
 * Builds a ParamGraph from DMMF at client generation time.
 *
 * The ParamGraph is a compact data structure that enables schema-aware
 * parameterization at runtime. It only stores parameterizable paths,
 * and uses a string table to de-duplicate field names.
 */

import type * as DMMF from '@prisma/dmmf'
import { ModelAction } from '@prisma/dmmf'
import {
  EdgeFlag,
  InputEdge,
  InputNode,
  NodeId,
  OutputEdge,
  OutputNode,
  ParamGraph,
  RootEntry,
  scalarTypeToMask,
} from '@prisma/param-graph'

/**
 * Helper class to build ParamGraph incrementally.
 * Provides methods to intern strings, allocate nodes, and record roots.
 */
class ParamGraphBuilder {
  private readonly stringTable: string[] = []
  private readonly stringToIndex = new Map<string, number>()
  private readonly enumNames: string[] = []
  private readonly enumToIndex = new Map<string, number>()
  private readonly inputNodes: InputNode[] = []
  private readonly outputNodes: OutputNode[] = []
  private readonly roots: Record<string, RootEntry> = {}

  private readonly inputTypeNodeCache = new Map<string, NodeId | undefined>()
  private readonly unionNodeCache = new Map<string, NodeId | undefined>()
  private readonly outputTypeNodeCache = new Map<string, NodeId | undefined>()

  /**
   * Interns a string into the string table, returning its index.
   */
  internString(str: string): number {
    let index = this.stringToIndex.get(str)
    if (index === undefined) {
      index = this.stringTable.length
      this.stringTable.push(str)
      this.stringToIndex.set(str, index)
    }
    return index
  }

  /**
   * Registers a user enum name, returning its index.
   */
  registerEnum(enumName: string): number {
    let index = this.enumToIndex.get(enumName)
    if (index === undefined) {
      index = this.enumNames.length
      this.enumNames.push(enumName)
      this.enumToIndex.set(enumName, index)
    }
    return index
  }

  /**
   * Allocates a new input node and returns its ID.
   */
  allocateInputNode(): NodeId {
    const id = this.inputNodes.length
    this.inputNodes.push({})
    return id
  }

  /**
   * Sets fields on an input node.
   */
  setInputNodeFields(nodeId: NodeId, fields: Record<number, InputEdge>): void {
    if (Object.keys(fields).length > 0) {
      this.inputNodes[nodeId].f = fields
    }
  }

  /**
   * Allocates a new output node and returns its ID.
   */
  allocateOutputNode(): NodeId {
    const id = this.outputNodes.length
    this.outputNodes.push({})
    return id
  }

  /**
   * Sets fields on an output node.
   */
  setOutputNodeFields(nodeId: NodeId, fields: Record<number, OutputEdge>): void {
    if (Object.keys(fields).length > 0) {
      this.outputNodes[nodeId].f = fields
    }
  }

  /**
   * Records a root entry for an operation.
   */
  setRoot(key: string, entry: RootEntry): void {
    // Only set if the entry has at least one defined property
    if (entry.a !== undefined || entry.o !== undefined) {
      this.roots[key] = entry
    }
  }

  /**
   * Gets or sets a cached input type node ID.
   */
  getInputTypeNode(typeName: string): NodeId | undefined {
    return this.inputTypeNodeCache.get(typeName)
  }

  setInputTypeNode(typeName: string, nodeId: NodeId | undefined): void {
    this.inputTypeNodeCache.set(typeName, nodeId)
  }

  hasInputTypeNode(typeName: string): boolean {
    return this.inputTypeNodeCache.has(typeName)
  }

  /**
   * Gets or sets a cached union node ID.
   */
  getUnionNode(key: string): NodeId | undefined {
    return this.unionNodeCache.get(key)
  }

  setUnionNode(key: string, nodeId: NodeId | undefined): void {
    this.unionNodeCache.set(key, nodeId)
  }

  hasUnionNode(key: string): boolean {
    return this.unionNodeCache.has(key)
  }

  /**
   * Gets or sets a cached output type node ID.
   */
  getOutputTypeNode(typeName: string): NodeId | undefined {
    return this.outputTypeNodeCache.get(typeName)
  }

  setOutputTypeNode(typeName: string, nodeId: NodeId | undefined): void {
    this.outputTypeNodeCache.set(typeName, nodeId)
  }

  hasOutputTypeNode(typeName: string): boolean {
    return this.outputTypeNodeCache.has(typeName)
  }

  /**
   * Builds the final ParamGraph.
   */
  build(): ParamGraph {
    return {
      s: this.stringTable,
      e: this.enumNames,
      i: this.inputNodes,
      o: this.outputNodes,
      r: this.roots,
    }
  }
}

/**
 * Builds a ParamGraph from DMMF schema.
 */
export function buildParamGraph(dmmf: DMMF.Document): ParamGraph {
  const builder = new ParamGraphBuilder()

  // Build maps for quick lookup
  const inputTypeMap = new Map<string, DMMF.InputType>()
  const outputTypeMap = new Map<string, DMMF.OutputType>()
  const userEnumNames = new Set<string>()

  // Collect user-defined enum names
  for (const e of dmmf.datamodel.enums) {
    userEnumNames.add(e.name)
  }

  // Collect all input types
  for (const inputType of dmmf.schema.inputObjectTypes.prisma ?? []) {
    inputTypeMap.set(getTypeName(inputType.name, 'prisma'), inputType)
  }
  for (const inputType of dmmf.schema.inputObjectTypes.model ?? []) {
    inputTypeMap.set(getTypeName(inputType.name, 'model'), inputType)
  }

  // Collect all output types
  for (const outputType of dmmf.schema.outputObjectTypes.prisma) {
    outputTypeMap.set(getTypeName(outputType.name, 'prisma'), outputType)
  }
  for (const outputType of dmmf.schema.outputObjectTypes.model) {
    outputTypeMap.set(getTypeName(outputType.name, 'model'), outputType)
  }

  function buildInputNodeFromArgs(args: readonly DMMF.SchemaArg[]): NodeId | undefined {
    const fields: Record<number, InputEdge> = {}
    let hasAnyField = false

    for (const arg of args) {
      const edge = buildInputEdge(arg)
      if (edge) {
        const stringIndex = builder.internString(arg.name)
        fields[stringIndex] = edge
        hasAnyField = true
      }
    }

    if (!hasAnyField) {
      return undefined
    }

    const nodeId = builder.allocateInputNode()
    builder.setInputNodeFields(nodeId, fields)
    return nodeId
  }

  function buildInputEdge(arg: DMMF.SchemaArg): InputEdge | undefined {
    return mergeFieldVariants([arg])
  }

  function buildInputTypeNode(typeName: string): NodeId | undefined {
    if (builder.hasInputTypeNode(typeName)) {
      return builder.getInputTypeNode(typeName)
    }

    const inputType = inputTypeMap.get(typeName)
    if (!inputType) {
      builder.setInputTypeNode(typeName, undefined)
      return undefined
    }

    // Pre-allocate node to handle cycles
    const nodeId = builder.allocateInputNode()
    builder.setInputTypeNode(typeName, nodeId)

    const fields: Record<number, InputEdge> = {}
    let hasAnyField = false

    for (const field of inputType.fields) {
      const edge = buildInputEdge(field)
      if (edge) {
        const stringIndex = builder.internString(field.name)
        fields[stringIndex] = edge
        hasAnyField = true
      }
    }

    if (hasAnyField) {
      builder.setInputNodeFields(nodeId, fields)
      return nodeId
    }

    // Node has no parameterizable fields - but we already allocated it
    // Return it anyway as it may be referenced in cycles
    return nodeId
  }

  function buildUnionNode(typeNames: string[]): NodeId | undefined {
    // Sort type names for stable cache key
    const sortedNames = [...typeNames].sort()
    const cacheKey = sortedNames.join('|')

    if (builder.hasUnionNode(cacheKey)) {
      return builder.getUnionNode(cacheKey)
    }

    // Pre-allocate node
    const nodeId = builder.allocateInputNode()
    builder.setUnionNode(cacheKey, nodeId)

    // Collect all fields from all variants
    const fieldsByName = new Map<string, DMMF.SchemaArg[]>()

    for (const typeName of typeNames) {
      const inputType = inputTypeMap.get(typeName)
      if (!inputType) continue

      for (const field of inputType.fields) {
        let fieldsForName = fieldsByName.get(field.name)
        if (!fieldsForName) {
          fieldsForName = []
          fieldsByName.set(field.name, fieldsForName)
        }
        fieldsForName.push(field)
      }
    }

    // Merge fields conservatively
    const mergedFields: Record<number, InputEdge> = {}
    let hasAnyField = false

    for (const [fieldName, variantFields] of fieldsByName) {
      const mergedEdge = mergeFieldVariants(variantFields)
      if (mergedEdge) {
        const stringIndex = builder.internString(fieldName)
        mergedFields[stringIndex] = mergedEdge
        hasAnyField = true
      }
    }

    if (hasAnyField) {
      builder.setInputNodeFields(nodeId, mergedFields)
    }

    return nodeId
  }

  function mergeFieldVariants(variants: DMMF.SchemaArg[]): InputEdge | undefined {
    let flags = 0
    let scalarMask = 0
    let childNodeId: NodeId | undefined
    let enumNameId: number | undefined

    const scalarTypes: DMMF.InputTypeRef[] = []
    const enumTypes: DMMF.InputTypeRef[] = []
    const inputObjectTypes: DMMF.InputTypeRef[] = []

    for (const variant of variants) {
      for (const inputType of variant.inputTypes) {
        switch (inputType.location) {
          case 'scalar':
            if (variant.isParameterizable) {
              scalarTypes.push(inputType)
            }
            break
          case 'enumTypes':
            if (variant.isParameterizable) {
              enumTypes.push(inputType)
            }
            break
          case 'inputObjectTypes':
            if (
              !inputObjectTypes.some(
                (ot) =>
                  ot.type === inputType.type && ot.namespace === inputType.namespace && ot.isList === inputType.isList,
              )
            ) {
              inputObjectTypes.push(inputType)
            }
            break
          case 'fieldRefTypes':
            break
          default:
            inputType.location satisfies never
        }
      }
    }

    for (const st of scalarTypes) {
      scalarMask |= scalarTypeToMask(st.type)
      if (st.isList) {
        flags |= EdgeFlag.ParamListScalar
      } else {
        flags |= EdgeFlag.ParamScalar
      }
    }

    for (const et of enumTypes) {
      if (et.namespace === 'model') {
        enumNameId = builder.registerEnum(et.type)
        if (et.isList) {
          flags |= EdgeFlag.ParamListEnum
        } else {
          flags |= EdgeFlag.ParamEnum
        }
        break
      }
    }

    if (inputObjectTypes.length > 0) {
      const hasObjectList = inputObjectTypes.some((iot) => iot.isList)
      const hasSingleObject = inputObjectTypes.some((iot) => !iot.isList)

      if (hasObjectList) {
        flags |= EdgeFlag.ListObject
      }
      if (hasSingleObject) {
        flags |= EdgeFlag.Object
      }

      if (inputObjectTypes.length === 1) {
        childNodeId = buildInputTypeNode(getTypeName(inputObjectTypes[0].type, inputObjectTypes[0].namespace))
      } else {
        childNodeId = buildUnionNode(inputObjectTypes.map((iot) => getTypeName(iot.type, iot.namespace)))
      }
    }

    // If no flags are set, this field is not parameterizable
    if (flags === 0) {
      return undefined
    }

    const edge: InputEdge = { k: flags }
    if (childNodeId !== undefined) {
      edge.c = childNodeId
    }
    if (scalarMask !== 0) {
      edge.m = scalarMask
    }
    if (enumNameId !== undefined) {
      edge.e = enumNameId
    }

    return edge
  }

  function buildOutputTypeNode(typeName: string): NodeId | undefined {
    if (builder.hasOutputTypeNode(typeName)) {
      return builder.getOutputTypeNode(typeName)
    }

    const outputType = outputTypeMap.get(typeName)
    if (!outputType) {
      builder.setOutputTypeNode(typeName, undefined)
      return undefined
    }

    // Pre-allocate to handle cycles
    const nodeId = builder.allocateOutputNode()
    builder.setOutputTypeNode(typeName, nodeId)

    const fields: Record<number, OutputEdge> = {}
    let hasAnyField = false

    for (const field of outputType.fields) {
      const edge = buildOutputEdge(field)
      if (edge) {
        const stringIndex = builder.internString(field.name)
        fields[stringIndex] = edge
        hasAnyField = true
      }
    }

    if (hasAnyField) {
      builder.setOutputNodeFields(nodeId, fields)
      return nodeId
    }

    return nodeId
  }

  function buildOutputEdge(field: DMMF.SchemaField): OutputEdge | undefined {
    let argsNodeId: NodeId | undefined
    let childOutputNodeId: NodeId | undefined

    if (field.args.length > 0) {
      argsNodeId = buildInputNodeFromArgs(field.args)
    }

    if (field.outputType.location === 'outputObjectTypes') {
      childOutputNodeId = buildOutputTypeNode(getTypeName(field.outputType.type, field.outputType.namespace))
    }

    if (argsNodeId === undefined && childOutputNodeId === undefined) {
      return undefined
    }

    const edge: OutputEdge = {}
    if (argsNodeId !== undefined) {
      edge.a = argsNodeId
    }
    if (childOutputNodeId !== undefined) {
      edge.o = childOutputNodeId
    }

    return edge
  }

  for (const mapping of dmmf.mappings.modelOperations) {
    const modelName = mapping.model

    const actions = Object.keys(ModelAction) as `${ModelAction}`[]

    for (const action of actions) {
      const fieldName = mapping[action]
      if (!fieldName) continue

      let rootField: DMMF.SchemaField | undefined

      const queryType = outputTypeMap.get('prisma.Query')
      if (queryType) {
        rootField = queryType.fields.find((f) => f.name === fieldName)
      }

      if (!rootField) {
        const mutationType = outputTypeMap.get('prisma.Mutation')
        if (mutationType) {
          rootField = mutationType.fields.find((f) => f.name === fieldName)
        }
      }

      if (!rootField) continue

      const argsNodeId = buildInputNodeFromArgs(rootField.args)

      let outputNodeId: NodeId | undefined
      if (rootField.outputType.location === 'outputObjectTypes') {
        outputNodeId = buildOutputTypeNode(getTypeName(rootField.outputType.type, rootField.outputType.namespace))
      }

      const dmmfActionToJsonAction: Partial<Record<ModelAction, string>> = {
        create: 'createOne',
        update: 'updateOne',
        delete: 'deleteOne',
        upsert: 'upsertOne',
      }

      const jsonAction = dmmfActionToJsonAction[action] ?? action

      const rootKey = `${modelName}.${jsonAction}`
      builder.setRoot(rootKey, { a: argsNodeId, o: outputNodeId })
    }
  }

  return builder.build()
}

function getTypeName(name: string, namespace: string | undefined): string {
  if (namespace === undefined) {
    return name
  }
  return `${namespace}.${name}`
}

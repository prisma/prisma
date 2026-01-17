/**
 * ParamGraphView: A runtime-friendly wrapper around the compact ParamGraph.
 *
 * This module provides a readable API on top of the compact graph structure,
 * hiding one-letter field names and providing fast string-to-index lookups.
 */

import type { RuntimeDataModel } from '@prisma/client-common'
import type { InputEdge, InputNode, NodeId, OutputEdge, OutputNode, ParamGraph, RootEntry } from '@prisma/param-graph'

/**
 * Runtime view of the ParamGraph with a readable API.
 * Built once per PrismaClient instance and reused for all queries.
 */
export type ParamGraphView = {
  /**
   * Look up a root entry by "Model.action" or "action".
   */
  root(key: string): RootEntry | undefined

  /**
   * Get an input node by ID.
   */
  inputNode(id?: NodeId): InputNode | undefined

  /**
   * Get an output node by ID.
   */
  outputNode(id?: NodeId): OutputNode | undefined

  /**
   * Get an input edge for a field name within a node.
   */
  inputEdge(node: InputNode | undefined, fieldName: string): InputEdge | undefined

  /**
   * Get an output edge for a field name within a node.
   */
  outputEdge(node: OutputNode | undefined, fieldName: string): OutputEdge | undefined

  /**
   * Get enum values for an edge that references a user enum.
   * Returns undefined if the edge doesn't reference an enum.
   */
  enumValues(edge: InputEdge | undefined): readonly string[] | undefined
}

/**
 * Creates a ParamGraphView from a ParamGraph and RuntimeDataModel.
 *
 * This should be called once per PrismaClient instance (in getPrismaClient)
 * and the resulting view reused for all queries.
 *
 * @param graph - The compact ParamGraph from the generated client
 * @param runtimeDataModel - The runtime data model for enum lookups
 * @returns A ParamGraphView for runtime traversal
 */
export function createParamGraphView(graph: ParamGraph, runtimeDataModel: RuntimeDataModel): ParamGraphView {
  // Build string-to-index map once for O(1) lookups
  const stringIndex = new Map<string, number>()
  for (let i = 0; i < graph.s.length; i++) {
    stringIndex.set(graph.s[i], i)
  }

  return {
    root(key: string): RootEntry | undefined {
      return graph.r[key]
    },

    inputNode(id?: NodeId): InputNode | undefined {
      if (id === undefined) {
        return undefined
      }
      return graph.i[id]
    },

    outputNode(id?: NodeId): OutputNode | undefined {
      if (id === undefined) {
        return undefined
      }
      return graph.o[id]
    },

    inputEdge(node: InputNode | undefined, fieldName: string): InputEdge | undefined {
      if (!node?.f) {
        return undefined
      }
      const idx = stringIndex.get(fieldName)
      if (idx === undefined) {
        return undefined
      }
      return node.f[idx]
    },

    outputEdge(node: OutputNode | undefined, fieldName: string): OutputEdge | undefined {
      if (!node?.f) {
        return undefined
      }
      const idx = stringIndex.get(fieldName)
      if (idx === undefined) {
        return undefined
      }
      return node.f[idx]
    },

    enumValues(edge: InputEdge | undefined): readonly string[] | undefined {
      if (edge?.e === undefined) {
        return undefined
      }
      const enumName = graph.en[edge.e]
      if (!enumName) {
        return undefined
      }
      const enumDef = runtimeDataModel.enums[enumName]
      if (!enumDef) {
        return undefined
      }
      // RuntimeEnum has a values array of EnumValue objects with name property
      // For runtime purposes, we need just the value names
      return enumDef.values.map((v) => v.name)
    },
  }
}

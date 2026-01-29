import { describe, expect, test } from 'vitest'

import { serializeParamGraph, deserializeParamGraph } from './serialization'
import type { ParamGraphData } from './types'

describe('param-graph serialization', () => {
  test('roundtrip with empty data', () => {
    const data: ParamGraphData = {
      strings: ['root1'],
      inputNodes: [],
      outputNodes: [],
      roots: { root1: {} },
    }

    const serialized = serializeParamGraph(data)
    const deserialized = deserializeParamGraph(serialized)

    expect(deserialized.strings).toEqual(data.strings)
    expect(deserialized.inputNodes).toEqual(data.inputNodes)
    expect(deserialized.outputNodes).toEqual(data.outputNodes)
    expect(deserialized.roots).toEqual(data.roots)
  })

  test('roundtrip with small data', () => {
    const data: ParamGraphData = {
      strings: ['findMany', 'where', 'id'],
      inputNodes: [{ edges: { 1: { flags: 0, scalarMask: 1 } } }],
      outputNodes: [{ edges: { 2: { argsNodeId: 0 } } }],
      roots: { findMany: { argsNodeId: 0, outputNodeId: 0 } },
    }

    const serialized = serializeParamGraph(data)
    const deserialized = deserializeParamGraph(serialized)

    expect(deserialized.strings).toEqual(data.strings)
    expect(deserialized.inputNodes.length).toBe(data.inputNodes.length)
    expect(deserialized.outputNodes.length).toBe(data.outputNodes.length)
    expect(Object.keys(deserialized.roots)).toEqual(Object.keys(data.roots))
  })

  test('roundtrip with multiple nodes and edges', () => {
    const data: ParamGraphData = {
      strings: ['findMany', 'create', 'update', 'where', 'data', 'id', 'name', 'Status'],
      inputNodes: [
        { edges: { 3: { flags: 1, scalarMask: 1, childNodeId: 1 }, 4: { flags: 0, scalarMask: 2 } } },
        { edges: { 5: { flags: 2, enumNameIndex: 7 } } },
      ],
      outputNodes: [{ edges: { 6: { argsNodeId: 0, outputNodeId: 1 } } }, { edges: {} }],
      roots: {
        findMany: { argsNodeId: 0, outputNodeId: 0 },
        create: { argsNodeId: 1, outputNodeId: 1 },
        update: { argsNodeId: 0 },
      },
    }

    const serialized = serializeParamGraph(data)
    const deserialized = deserializeParamGraph(serialized)

    expect(deserialized.inputNodes.length).toBe(2)
    expect(deserialized.outputNodes.length).toBe(2)
    expect(Object.keys(deserialized.roots).length).toBe(3)

    // Verify edge data is preserved
    const inputEdge = deserialized.inputNodes[0].edges[3]
    expect(inputEdge.flags).toBe(1)
    expect(inputEdge.scalarMask).toBe(1)
    expect(inputEdge.childNodeId).toBe(1)

    const enumEdge = deserialized.inputNodes[1].edges[5]
    expect(enumEdge.flags).toBe(2)
    expect(enumEdge.enumNameIndex).toBe(7)
  })

  test('handles undefined values correctly', () => {
    const data: ParamGraphData = {
      strings: ['root'],
      inputNodes: [{ edges: { 0: { flags: 0 } } }],
      outputNodes: [{ edges: { 0: {} } }],
      roots: { root: { argsNodeId: 0 } },
    }

    const serialized = serializeParamGraph(data)
    const deserialized = deserializeParamGraph(serialized)

    // Undefined values should not be present in deserialized data
    expect(deserialized.inputNodes[0].edges[0].childNodeId).toBeUndefined()
    expect(deserialized.inputNodes[0].edges[0].scalarMask).toBeUndefined()
    expect(deserialized.inputNodes[0].edges[0].enumNameIndex).toBeUndefined()
    expect(deserialized.outputNodes[0].edges[0].argsNodeId).toBeUndefined()
    expect(deserialized.outputNodes[0].edges[0].outputNodeId).toBeUndefined()
    expect(deserialized.roots['root'].outputNodeId).toBeUndefined()
  })

  test('base64url encoding produces URL-safe output', () => {
    const data: ParamGraphData = {
      strings: ['test'],
      inputNodes: [{ edges: { 255: { flags: 255, scalarMask: 65535, childNodeId: 0, enumNameIndex: 0 } } }],
      outputNodes: [],
      roots: { test: { argsNodeId: 0 } },
    }

    const serialized = serializeParamGraph(data)

    // Should only contain URL-safe characters
    expect(serialized.graph).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

/**
 * Binary serialization for ParamGraph.
 *
 * This module handles compact binary encoding/decoding of the param graph structure.
 * The format uses a hybrid approach: JSON string array for field names + binary blob
 * for structural data (nodes, edges, roots).
 */

import type { ParamGraphData, InputNodeData, OutputNodeData, InputEdgeData, OutputEdgeData, RootEntryData } from './types'

/**
 * Serialized format stored in the generated client.
 */
export interface SerializedParamGraph {
  /** String table (field names, enum names, root keys) */
  strings: string[]
  /** Base64url-encoded binary blob for structural data */
  graph: string
}

// Format version bytes
const FORMAT_COMPACT = 0x00
const FORMAT_WIDE = 0x01

// Sentinel values for "none/undefined"
const NONE_16 = 0xffff
const NONE_32 = 0xffffffff

// Thresholds for format selection
const MAX_COMPACT_INDEX = 0xfffe // Reserve 0xFFFF for sentinel

/**
 * Base64url encoding (RFC 4648).
 * Uses URL-safe alphabet without padding for shorter output.
 */
const BASE64URL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_'

function encodeBase64url(bytes: Uint8Array): string {
  let result = ''
  const len = bytes.length
  let i = 0

  while (i < len) {
    const b0 = bytes[i++]
    const hasB1 = i < len
    const b1 = hasB1 ? bytes[i++] : 0
    const hasB2 = i < len
    const b2 = hasB2 ? bytes[i++] : 0

    result += BASE64URL_CHARS[(b0 >> 2) & 0x3f]
    result += BASE64URL_CHARS[((b0 << 4) | (b1 >> 4)) & 0x3f]

    if (hasB1) {
      result += BASE64URL_CHARS[((b1 << 2) | (b2 >> 6)) & 0x3f]
    }
    if (hasB2) {
      result += BASE64URL_CHARS[b2 & 0x3f]
    }
  }

  return result
}

function decodeBase64url(str: string): Uint8Array {
  const charToIndex = new Uint8Array(128)
  for (let i = 0; i < BASE64URL_CHARS.length; i++) {
    charToIndex[BASE64URL_CHARS.charCodeAt(i)] = i
  }

  const len = str.length
  const outputLen = Math.floor((len * 3) / 4)
  const bytes = new Uint8Array(outputLen)

  let bi = 0
  for (let i = 0; i < len; ) {
    const c0 = charToIndex[str.charCodeAt(i++)]
    const c1 = i < len ? charToIndex[str.charCodeAt(i++)] : 0
    const c2 = i < len ? charToIndex[str.charCodeAt(i++)] : 0
    const c3 = i < len ? charToIndex[str.charCodeAt(i++)] : 0

    bytes[bi++] = (c0 << 2) | (c1 >> 4)
    if (bi < outputLen) bytes[bi++] = ((c1 << 4) | (c2 >> 2)) & 0xff
    if (bi < outputLen) bytes[bi++] = ((c2 << 6) | c3) & 0xff
  }

  return bytes
}

/**
 * Serializes a ParamGraphData to the compact binary format.
 */
export function serializeParamGraph(data: ParamGraphData): SerializedParamGraph {
  const rootKeys = Object.keys(data.roots)

  // Determine if we need wide format
  const maxIndex = Math.max(
    data.strings.length,
    data.inputNodes.length,
    data.outputNodes.length,
    rootKeys.length,
  )

  const useWide = maxIndex > MAX_COMPACT_INDEX

  // Calculate buffer size
  let size = 1 // format byte
  size += useWide ? 12 : 6 // header

  // Input nodes
  for (const node of data.inputNodes) {
    size += useWide ? 4 : 2 // edgeCount
    const edgeCount = Object.keys(node.edges).length
    size += edgeCount * (useWide ? 20 : 10) // edges
  }

  // Output nodes
  for (const node of data.outputNodes) {
    size += useWide ? 4 : 2 // edgeCount
    const edgeCount = Object.keys(node.edges).length
    size += edgeCount * (useWide ? 12 : 6) // edges
  }

  // Roots
  size += rootKeys.length * (useWide ? 12 : 6)

  const buffer = new ArrayBuffer(size)
  const view = new DataView(buffer)
  let offset = 0

  // Format byte
  view.setUint8(offset++, useWide ? FORMAT_WIDE : FORMAT_COMPACT)

  if (useWide) {
    view.setUint32(offset, data.inputNodes.length, true)
    offset += 4
    view.setUint32(offset, data.outputNodes.length, true)
    offset += 4
    view.setUint32(offset, rootKeys.length, true)
    offset += 4
  } else {
    view.setUint16(offset, data.inputNodes.length, true)
    offset += 2
    view.setUint16(offset, data.outputNodes.length, true)
    offset += 2
    view.setUint16(offset, rootKeys.length, true)
    offset += 2
  }

  // Input nodes
  for (const node of data.inputNodes) {
    const fieldIndices = Object.keys(node.edges).map(Number)

    if (useWide) {
      view.setUint32(offset, fieldIndices.length, true)
      offset += 4
    } else {
      view.setUint16(offset, fieldIndices.length, true)
      offset += 2
    }

    for (const fieldIndex of fieldIndices) {
      const edge = node.edges[fieldIndex]

      if (useWide) {
        view.setUint32(offset, fieldIndex, true)
        offset += 4
        view.setUint16(offset, edge.scalarMask ?? 0, true)
        offset += 2
        // Padding for alignment
        offset += 2
        view.setUint32(offset, edge.childNodeId ?? NONE_32, true)
        offset += 4
        view.setUint32(offset, edge.enumNameIndex ?? NONE_32, true)
        offset += 4
        view.setUint8(offset, edge.flags)
        offset += 1
        // Reserved bytes (3 for alignment)
        offset += 3
      } else {
        view.setUint16(offset, fieldIndex, true)
        offset += 2
        view.setUint16(offset, edge.scalarMask ?? 0, true)
        offset += 2
        view.setUint16(offset, edge.childNodeId ?? NONE_16, true)
        offset += 2
        view.setUint16(offset, edge.enumNameIndex ?? NONE_16, true)
        offset += 2
        view.setUint8(offset, edge.flags)
        offset += 1
        // Reserved byte
        offset += 1
      }
    }
  }

  // Output nodes
  for (const node of data.outputNodes) {
    const fieldIndices = Object.keys(node.edges).map(Number)

    if (useWide) {
      view.setUint32(offset, fieldIndices.length, true)
      offset += 4
    } else {
      view.setUint16(offset, fieldIndices.length, true)
      offset += 2
    }

    for (const fieldIndex of fieldIndices) {
      const edge = node.edges[fieldIndex]

      if (useWide) {
        view.setUint32(offset, fieldIndex, true)
        offset += 4
        view.setUint32(offset, edge.argsNodeId ?? NONE_32, true)
        offset += 4
        view.setUint32(offset, edge.outputNodeId ?? NONE_32, true)
        offset += 4
      } else {
        view.setUint16(offset, fieldIndex, true)
        offset += 2
        view.setUint16(offset, edge.argsNodeId ?? NONE_16, true)
        offset += 2
        view.setUint16(offset, edge.outputNodeId ?? NONE_16, true)
        offset += 2
      }
    }
  }

  // Roots
  for (const key of rootKeys) {
    const root = data.roots[key]
    const keyIndex = data.strings.indexOf(key)

    if (useWide) {
      view.setUint32(offset, keyIndex, true)
      offset += 4
      view.setUint32(offset, root.argsNodeId ?? NONE_32, true)
      offset += 4
      view.setUint32(offset, root.outputNodeId ?? NONE_32, true)
      offset += 4
    } else {
      view.setUint16(offset, keyIndex, true)
      offset += 2
      view.setUint16(offset, root.argsNodeId ?? NONE_16, true)
      offset += 2
      view.setUint16(offset, root.outputNodeId ?? NONE_16, true)
      offset += 2
    }
  }

  return {
    strings: data.strings,
    graph: encodeBase64url(new Uint8Array(buffer)),
  }
}

/**
 * Deserializes a binary-encoded ParamGraph.
 */
export function deserializeParamGraph(serialized: SerializedParamGraph): ParamGraphData {
  const bytes = decodeBase64url(serialized.graph)
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = 0

  // Format byte
  const format = view.getUint8(offset++)
  const useWide = format === FORMAT_WIDE

  // Header
  let inputNodeCount: number
  let outputNodeCount: number
  let rootCount: number

  if (useWide) {
    inputNodeCount = view.getUint32(offset, true)
    offset += 4
    outputNodeCount = view.getUint32(offset, true)
    offset += 4
    rootCount = view.getUint32(offset, true)
    offset += 4
  } else {
    inputNodeCount = view.getUint16(offset, true)
    offset += 2
    outputNodeCount = view.getUint16(offset, true)
    offset += 2
    rootCount = view.getUint16(offset, true)
    offset += 2
  }

  // Input nodes
  const inputNodes: InputNodeData[] = []
  for (let i = 0; i < inputNodeCount; i++) {
    let edgeCount: number
    if (useWide) {
      edgeCount = view.getUint32(offset, true)
      offset += 4
    } else {
      edgeCount = view.getUint16(offset, true)
      offset += 2
    }

    const edges: Record<number, InputEdgeData> = {}
    for (let j = 0; j < edgeCount; j++) {
      let fieldIndex: number
      let scalarMask: number
      let childNodeId: number
      let enumNameIndex: number
      let flags: number

      if (useWide) {
        fieldIndex = view.getUint32(offset, true)
        offset += 4
        scalarMask = view.getUint16(offset, true)
        offset += 2
        offset += 2 // padding
        childNodeId = view.getUint32(offset, true)
        offset += 4
        enumNameIndex = view.getUint32(offset, true)
        offset += 4
        flags = view.getUint8(offset)
        offset += 1
        offset += 3 // reserved
      } else {
        fieldIndex = view.getUint16(offset, true)
        offset += 2
        scalarMask = view.getUint16(offset, true)
        offset += 2
        childNodeId = view.getUint16(offset, true)
        offset += 2
        enumNameIndex = view.getUint16(offset, true)
        offset += 2
        flags = view.getUint8(offset)
        offset += 1
        offset += 1 // reserved
      }

      const edge: InputEdgeData = { flags }
      if (scalarMask !== 0) edge.scalarMask = scalarMask
      if (childNodeId !== (useWide ? NONE_32 : NONE_16)) edge.childNodeId = childNodeId
      if (enumNameIndex !== (useWide ? NONE_32 : NONE_16)) edge.enumNameIndex = enumNameIndex

      edges[fieldIndex] = edge
    }

    inputNodes.push({ edges })
  }

  // Output nodes
  const outputNodes: OutputNodeData[] = []
  for (let i = 0; i < outputNodeCount; i++) {
    let edgeCount: number
    if (useWide) {
      edgeCount = view.getUint32(offset, true)
      offset += 4
    } else {
      edgeCount = view.getUint16(offset, true)
      offset += 2
    }

    const edges: Record<number, OutputEdgeData> = {}
    for (let j = 0; j < edgeCount; j++) {
      let fieldIndex: number
      let argsNodeId: number
      let outputNodeId: number

      if (useWide) {
        fieldIndex = view.getUint32(offset, true)
        offset += 4
        argsNodeId = view.getUint32(offset, true)
        offset += 4
        outputNodeId = view.getUint32(offset, true)
        offset += 4
      } else {
        fieldIndex = view.getUint16(offset, true)
        offset += 2
        argsNodeId = view.getUint16(offset, true)
        offset += 2
        outputNodeId = view.getUint16(offset, true)
        offset += 2
      }

      const edge: OutputEdgeData = {}
      if (argsNodeId !== (useWide ? NONE_32 : NONE_16)) edge.argsNodeId = argsNodeId
      if (outputNodeId !== (useWide ? NONE_32 : NONE_16)) edge.outputNodeId = outputNodeId

      edges[fieldIndex] = edge
    }

    outputNodes.push({ edges })
  }

  // Roots
  const roots: Record<string, RootEntryData> = {}
  for (let i = 0; i < rootCount; i++) {
    let keyIndex: number
    let argsNodeId: number
    let outputNodeId: number

    if (useWide) {
      keyIndex = view.getUint32(offset, true)
      offset += 4
      argsNodeId = view.getUint32(offset, true)
      offset += 4
      outputNodeId = view.getUint32(offset, true)
      offset += 4
    } else {
      keyIndex = view.getUint16(offset, true)
      offset += 2
      argsNodeId = view.getUint16(offset, true)
      offset += 2
      outputNodeId = view.getUint16(offset, true)
      offset += 2
    }

    const key = serialized.strings[keyIndex]
    const root: RootEntryData = {}
    if (argsNodeId !== (useWide ? NONE_32 : NONE_16)) root.argsNodeId = argsNodeId
    if (outputNodeId !== (useWide ? NONE_32 : NONE_16)) root.outputNodeId = outputNodeId

    roots[key] = root
  }

  return {
    strings: serialized.strings,
    inputNodes,
    outputNodes,
    roots,
  }
}

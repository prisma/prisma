/**
 * Binary serialization for ParamGraph.
 *
 * This module handles compact binary encoding/decoding of the param graph structure.
 * The format uses a hybrid approach: JSON string array for field names + binary blob
 * for structural data (nodes, edges, roots).
 */

import type {
  InputEdgeData,
  InputNodeData,
  OutputEdgeData,
  OutputNodeData,
  ParamGraphData,
  RootEntryData,
} from './types'

/**
 * Serialized format stored in the generated client.
 */
export interface SerializedParamGraph {
  /** String table (field names, enum names, root keys) */
  strings: string[]
  /** Base64url-encoded binary blob for structural data */
  graph: string
}

/**
 * Serializes a ParamGraphData to the compact binary format.
 */
export function serializeParamGraph(data: ParamGraphData): SerializedParamGraph {
  return new Serializer(data).serialize()
}

/**
 * Deserializes a binary-encoded ParamGraph.
 */
export function deserializeParamGraph(serialized: SerializedParamGraph): ParamGraphData {
  return new Deserializer(serialized).deserialize()
}

// Format version bytes
const FORMAT_COMPACT = 0x00
const FORMAT_WIDE = 0x01

// Sentinel values for "none/undefined"
const NONE_16 = 0xffff
const NONE_32 = 0xffffffff

// Thresholds for format selection
const MAX_COMPACT_INDEX = 0xfffe // Reserve 0xFFFF for sentinel

function encodeBase64url(bytes: Uint8Array): string {
  return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength).toString('base64url')
}

function decodeBase64url(str: string): Uint8Array {
  return Buffer.from(str, 'base64url')
}

class Serializer {
  #data: ParamGraphData
  #useWide: boolean
  #buffer: ArrayBuffer
  #view: DataView
  #offset: number = 0
  #rootKeys: string[]

  constructor(data: ParamGraphData) {
    this.#data = data
    this.#rootKeys = Object.keys(data.roots)

    const maxIndex = Math.max(
      data.strings.length,
      data.inputNodes.length,
      data.outputNodes.length,
      this.#rootKeys.length,
    )

    this.#useWide = maxIndex > MAX_COMPACT_INDEX

    const size = this.#calculateBufferSize()
    this.#buffer = new ArrayBuffer(size)
    this.#view = new DataView(this.#buffer)
  }

  serialize(): SerializedParamGraph {
    this.#writeHeader()
    this.#writeInputNodes()
    this.#writeOutputNodes()
    this.#writeRoots()

    return {
      strings: this.#data.strings,
      graph: encodeBase64url(new Uint8Array(this.#buffer)),
    }
  }

  get #wordSize(): number {
    return this.#useWide ? 4 : 2
  }

  get #noneValue(): number {
    return this.#useWide ? NONE_32 : NONE_16
  }

  #writeWord(value: number): void {
    if (this.#useWide) {
      this.#view.setUint32(this.#offset, value, true)
    } else {
      this.#view.setUint16(this.#offset, value, true)
    }
    this.#offset += this.#wordSize
  }

  #writeOptionalWord(value: number | undefined): void {
    this.#writeWord(value ?? this.#noneValue)
  }

  #writeByte(value: number): void {
    this.#view.setUint8(this.#offset, value)
    this.#offset += 1
  }

  #writeU16(value: number): void {
    this.#view.setUint16(this.#offset, value, true)
    this.#offset += 2
  }

  #skip(bytes: number): void {
    this.#offset += bytes
  }

  #calculateBufferSize(): number {
    let size = 1 // format byte
    size += this.#useWide ? 12 : 6 // header

    for (const node of this.#data.inputNodes) {
      size += this.#wordSize // edgeCount
      const edgeCount = Object.keys(node.edges).length
      size += edgeCount * (this.#useWide ? 20 : 10) // edges
    }

    for (const node of this.#data.outputNodes) {
      size += this.#wordSize // edgeCount
      const edgeCount = Object.keys(node.edges).length
      size += edgeCount * (this.#useWide ? 12 : 6) // edges
    }

    size += this.#rootKeys.length * (this.#useWide ? 12 : 6)

    return size
  }

  #writeHeader(): void {
    this.#writeByte(this.#useWide ? FORMAT_WIDE : FORMAT_COMPACT)
    this.#writeWord(this.#data.inputNodes.length)
    this.#writeWord(this.#data.outputNodes.length)
    this.#writeWord(this.#rootKeys.length)
  }

  #writeInputNodes(): void {
    for (const node of this.#data.inputNodes) {
      const fieldIndices = Object.keys(node.edges).map(Number)
      this.#writeWord(fieldIndices.length)

      for (const fieldIndex of fieldIndices) {
        const edge = node.edges[fieldIndex]

        this.#writeWord(fieldIndex)
        this.#writeU16(edge.scalarMask ?? 0)
        if (this.#useWide) {
          this.#skip(2) // padding for alignment
        }
        this.#writeOptionalWord(edge.childNodeId)
        this.#writeOptionalWord(edge.enumNameIndex)
        this.#writeByte(edge.flags)
        this.#skip(this.#useWide ? 3 : 1) // padding for alignment
      }
    }
  }

  #writeOutputNodes(): void {
    for (const node of this.#data.outputNodes) {
      const fieldIndices = Object.keys(node.edges).map(Number)
      this.#writeWord(fieldIndices.length)

      for (const fieldIndex of fieldIndices) {
        const edge = node.edges[fieldIndex]

        this.#writeWord(fieldIndex)
        this.#writeOptionalWord(edge.argsNodeId)
        this.#writeOptionalWord(edge.outputNodeId)
      }
    }
  }

  #writeRoots(): void {
    for (const key of this.#rootKeys) {
      const root = this.#data.roots[key]
      const keyIndex = this.#data.strings.indexOf(key)

      this.#writeWord(keyIndex)
      this.#writeOptionalWord(root.argsNodeId)
      this.#writeOptionalWord(root.outputNodeId)
    }
  }
}

class Deserializer {
  #serialized: SerializedParamGraph
  #view: DataView
  #offset: number = 0
  #useWide: boolean = false

  constructor(serialized: SerializedParamGraph) {
    this.#serialized = serialized
    const bytes = decodeBase64url(serialized.graph)
    this.#view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }

  deserialize(): ParamGraphData {
    const { inputNodeCount, outputNodeCount, rootCount } = this.#readHeader()
    const inputNodes = this.#readInputNodes(inputNodeCount)
    const outputNodes = this.#readOutputNodes(outputNodeCount)
    const roots = this.#readRoots(rootCount)

    return {
      strings: this.#serialized.strings,
      inputNodes,
      outputNodes,
      roots,
    }
  }

  get #wordSize(): number {
    return this.#useWide ? 4 : 2
  }

  get #noneValue(): number {
    return this.#useWide ? NONE_32 : NONE_16
  }

  #readWord(): number {
    let value: number
    if (this.#useWide) {
      value = this.#view.getUint32(this.#offset, true)
    } else {
      value = this.#view.getUint16(this.#offset, true)
    }
    this.#offset += this.#wordSize
    return value
  }

  #readOptionalWord(): number | undefined {
    const value = this.#readWord()
    return value === this.#noneValue ? undefined : value
  }

  #readByte(): number {
    const value = this.#view.getUint8(this.#offset)
    this.#offset += 1
    return value
  }

  #readU16(): number {
    const value = this.#view.getUint16(this.#offset, true)
    this.#offset += 2
    return value
  }

  #skip(bytes: number): void {
    this.#offset += bytes
  }

  #readHeader(): { inputNodeCount: number; outputNodeCount: number; rootCount: number } {
    const format = this.#readByte()
    this.#useWide = format === FORMAT_WIDE

    const inputNodeCount = this.#readWord()
    const outputNodeCount = this.#readWord()
    const rootCount = this.#readWord()

    return { inputNodeCount, outputNodeCount, rootCount }
  }

  #readInputNodes(count: number): InputNodeData[] {
    const inputNodes: InputNodeData[] = []

    for (let i = 0; i < count; i++) {
      const edgeCount = this.#readWord()
      const edges: Record<number, InputEdgeData> = {}

      for (let j = 0; j < edgeCount; j++) {
        const fieldIndex = this.#readWord()
        const scalarMask = this.#readU16()
        if (this.#useWide) {
          this.#skip(2) // padding
        }
        const childNodeId = this.#readOptionalWord()
        const enumNameIndex = this.#readOptionalWord()
        const flags = this.#readByte()
        this.#skip(this.#useWide ? 3 : 1) // padding

        const edge: InputEdgeData = { flags }
        if (scalarMask !== 0) edge.scalarMask = scalarMask
        if (childNodeId !== undefined) edge.childNodeId = childNodeId
        if (enumNameIndex !== undefined) edge.enumNameIndex = enumNameIndex

        edges[fieldIndex] = edge
      }

      inputNodes.push({ edges })
    }

    return inputNodes
  }

  #readOutputNodes(count: number): OutputNodeData[] {
    const outputNodes: OutputNodeData[] = []

    for (let i = 0; i < count; i++) {
      const edgeCount = this.#readWord()
      const edges: Record<number, OutputEdgeData> = {}

      for (let j = 0; j < edgeCount; j++) {
        const fieldIndex = this.#readWord()
        const argsNodeId = this.#readOptionalWord()
        const outputNodeId = this.#readOptionalWord()

        const edge: OutputEdgeData = {}
        if (argsNodeId !== undefined) edge.argsNodeId = argsNodeId
        if (outputNodeId !== undefined) edge.outputNodeId = outputNodeId

        edges[fieldIndex] = edge
      }

      outputNodes.push({ edges })
    }

    return outputNodes
  }

  #readRoots(count: number): Record<string, RootEntryData> {
    const roots: Record<string, RootEntryData> = {}

    for (let i = 0; i < count; i++) {
      const keyIndex = this.#readWord()
      const argsNodeId = this.#readOptionalWord()
      const outputNodeId = this.#readOptionalWord()

      const key = this.#serialized.strings[keyIndex]
      const root: RootEntryData = {}
      if (argsNodeId !== undefined) root.argsNodeId = argsNodeId
      if (outputNodeId !== undefined) root.outputNodeId = outputNodeId

      roots[key] = root
    }

    return roots
  }
}

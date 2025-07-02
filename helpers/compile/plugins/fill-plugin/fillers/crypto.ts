export const webcrypto = globalThis.crypto

export function randomUUID(): string {
  return globalThis.crypto.randomUUID()
}

export function randomFillSync(buffer: Uint8Array, offset?: number, length?: number): Uint8Array {
  if (offset !== undefined) {
    if (length !== undefined) {
      buffer = buffer.subarray(offset, offset + length)
    } else {
      buffer = buffer.subarray(offset)
    }
  }
  return globalThis.crypto.getRandomValues(buffer)
}

export function createHash(algorithm: string): Hash {
  return new Hash(algorithm)
}

export class Hash {
  #chunks: Uint8Array[] = []
  #algorithm: string

  constructor(algorithm: string) {
    this.#algorithm = algorithm
  }

  update(data: Uint8Array): void {
    this.#chunks.push(data)
  }

  async digest(): Promise<Uint8Array> {
    const data = new Uint8Array(this.#chunks.reduce((acc, chunk) => acc + chunk.length, 0))
    let offset = 0
    for (const chunk of this.#chunks) {
      data.set(chunk, offset)
      offset += chunk.length
    }
    const arrayBuffer = await globalThis.crypto.subtle.digest(this.#algorithm, data)
    return new Uint8Array(arrayBuffer)
  }
}

export default {
  webcrypto,
  randomUUID,
  randomFillSync,
  createHash,
  Hash,
}

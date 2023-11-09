export class Buffer extends Uint8Array {
  constructor(input: any) {
    if (typeof input === 'number') {
      super(input)
    } else if (typeof input === 'string') {
      super(new TextEncoder().encode(input))
    } else if (Array.isArray(input)) {
      super(input)
    } else {
      throw new Error('Unsupported argument type')
    }
  }

  copy(targetBuffer: Buffer, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
    if (!(targetBuffer instanceof Uint8Array)) {
      throw new Error('First argument must be a Buffer')
    }

    for (let i = sourceStart; i < sourceEnd; i++) {
      targetBuffer[targetStart++] = this[i]
    }
  }
}

Buffer.from = (input: any) => new Buffer(input)

// @ts-ignore
Buffer.isBuffer = (buffer: any) => buffer instanceof Uint8Array

// @ts-ignore
Buffer.concat = (list, totalLength) => {
  if (!Array.isArray(list)) {
    throw new Error('First argument must be an Array of Buffer objects')
  }

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  if (typeof totalLength !== 'number') {
    totalLength = 0
    for (let i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  const buffer = new Buffer(totalLength)
  let pos = 0
  for (let i = 0; i < list.length; i++) {
    const buf = list[i]
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

const buffer = {
  Buffer,
}

export default buffer

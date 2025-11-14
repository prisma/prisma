import { Readable } from 'node:stream'

import byline from '../byline'

/**
 * Helper function to collect all lines from a LineStream
 */
async function collectLines(stream: NodeJS.ReadableStream): Promise<string[]> {
  const lines: string[] = []
  return new Promise((resolve, reject) => {
    stream.on('data', (line: Buffer | string) => {
      lines.push(line.toString())
    })
    stream.on('end', () => resolve(lines))
    stream.on('error', reject)
  })
}

/**
 * Helper function to create a readable stream from chunks
 */
function createReadableFromChunks(chunks: Buffer[]): Readable {
  let index = 0
  return new Readable({
    read() {
      if (index < chunks.length) {
        this.push(chunks[index])
        index++
      } else {
        this.push(null)
      }
    },
  })
}

describe('LineStream', () => {
  describe('single-byte characters', () => {
    it('handles single chunk', async () => {
      const input = 'line1\nline2\nline3\n'
      const stream = createReadableFromChunks([Buffer.from(input, 'utf8')])
      const lineStream = byline(stream)

      const lines = await collectLines(lineStream)
      expect(lines).toEqual(['line1', 'line2', 'line3'])
    })

    it('handles split across chunk boundary', async () => {
      const chunk1 = Buffer.from('Hello ', 'utf8')
      const chunk2 = Buffer.from('World\n', 'utf8')
      const stream = createReadableFromChunks([chunk1, chunk2])
      const lineStream = byline(stream)

      const lines = await collectLines(lineStream)
      expect(lines).toEqual(['Hello World'])
    })
  })

  describe('multibyte characters', () => {
    it('handles single chunk', async () => {
      const input = 'Hello 😀\n日本語\n'
      const stream = createReadableFromChunks([Buffer.from(input, 'utf8')])
      const lineStream = byline(stream)

      const lines = await collectLines(lineStream)
      expect(lines).toEqual(['Hello 😀', '日本語'])
    })

    it('handles split across chunk boundary', async () => {
      // Japanese "あ" is 3 bytes in UTF-8: E3 81 82
      const text = 'Test あ\n'
      const fullBuffer = Buffer.from(text, 'utf8')

      // Split in the middle of "あ"
      // "Test " = 5 bytes, "あ" = 3 bytes (E3 81 82)
      const splitPoint = 6
      const chunk1 = fullBuffer.subarray(0, splitPoint)
      const chunk2 = fullBuffer.subarray(splitPoint)

      const stream = createReadableFromChunks([chunk1, chunk2])
      const lineStream = byline(stream)

      const lines = await collectLines(lineStream)
      expect(lines).toEqual(['Test あ'])
    })

    it('handles truncated multibyte at end of stream', async () => {
      // Test _flush method with truly incomplete bytes (data corruption scenario)
      // Stream ends with incomplete UTF-8 sequence - decoder.end() returns replacement char
      const text = 'Complete line\nIncomplete'
      const fullBuffer = Buffer.from(text, 'utf8')

      // Add incomplete UTF-8 bytes at the end (first 2 bytes of "あ": E3 81)
      const incompleteBytes = Buffer.from([0xe3, 0x81])
      const chunk = Buffer.concat([fullBuffer, incompleteBytes])

      const stream = createReadableFromChunks([chunk])
      const lineStream = byline(stream)

      const lines = await collectLines(lineStream)
      // Should get single replacement character (�) for incomplete UTF-8 sequence
      expect(lines).toEqual(['Complete line', 'Incomplete�'])
    })
  })
})

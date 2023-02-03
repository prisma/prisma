import { Writer } from './Writer'

test('write string', () => {
  const writer = new Writer(0, undefined)
  writer.write('A').write('B').write('C')
  expect(writer.toString()).toBe('ABC')
})

test('write builder', () => {
  const builder = {
    write(writer: Writer) {
      writer.write('hello from builder')
    },
  }
  const writer = new Writer(0, undefined)
  writer.write(builder)
  expect(writer.toString()).toBe('hello from builder')
})

test('newLine', () => {
  const writer = new Writer(0, undefined)
  writer.newLine()
  expect(writer.toString()).toBe('\n')
})

test('writeLine', () => {
  const writer = new Writer(0, undefined)
  writer.writeLine('A').writeLine('B').writeLine('C')
  expect(writer.toString()).toBe('A\nB\nC\n')
})

test('writeJoined with strings', () => {
  const writer = new Writer(0, undefined)
  writer.writeJoined(', ', ['A', 'B', 'C'])
  expect(writer.toString()).toBe('A, B, C')
})

test('writeJoined with builder values', () => {
  const writer = new Writer(0, undefined)

  const builder = {
    write(writer: Writer) {
      writer.write('builder')
    },
  }
  writer.writeJoined(', ', [builder, builder, builder])
  expect(writer.toString()).toBe('builder, builder, builder')
})

test('writeJoined with builder separator', () => {
  const writer = new Writer(0, undefined)

  const separator = {
    write(writer: Writer) {
      writer.write('|')
    },
  }
  writer.writeJoined(separator, ['A', 'B', 'C'])
  expect(writer.toString()).toBe('A|B|C')
})

test('writeJoined empty', () => {
  const writer = new Writer(0, undefined)
  writer.writeJoined(', ', [])
  expect(writer.toString()).toBe('')
})

test('indent', () => {
  const writer = new Writer(0, undefined)
  writer.indent().write('A')
  expect(writer.toString()).toBe('  A')
})

test('indent + unindent', () => {
  const writer = new Writer(0, undefined)
  writer.writeLine('A').indent().writeLine('B').unindent().writeLine('C')
  expect(writer.toString()).toBe('A\n  B\nC\n')
})

test('unindent beyond 0', () => {
  const writer = new Writer(0, undefined)
  writer.unindent().unindent().write('A')
  expect(writer.toString()).toBe('A')
})

test('withIndent', () => {
  const writer = new Writer(0, undefined)
  writer
    .writeLine('A')
    .withIndent(() => writer.writeLine('B'))
    .writeLine('C')
  expect(writer.toString()).toBe('A\n  B\nC\n')
})

test('after next newline callback', () => {
  const writer = new Writer(0, undefined)
  writer.afterNextNewline(() => {
    writer.writeLine('---')
  })
  writer.writeLine('foo')
  writer.writeLine('bar')
  expect(writer.toString()).toBe('foo\n---\nbar\n')
})

test('margin symbol', () => {
  const writer = new Writer(0, undefined)
  writer
    .writeLine('{')
    .withIndent(() => {
      writer.addMarginSymbol('+').writeLine('foo').writeLine('bar')
    })
    .writeLine('}')

  expect(writer.toString()).toMatchInlineSnapshot(`
    {
    + foo
      bar
    }

  `)
})

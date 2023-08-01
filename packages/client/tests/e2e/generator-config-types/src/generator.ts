import assert from 'node:assert/strict'

import { generatorHandler } from '@prisma/generator-helper'
import { expectTypeOf } from 'expect-type'

generatorHandler({
  onManifest() {
    return {
      defaultOutput: '.',
      prettyName: 'Test generator',
    }
  },

  onGenerate(options) {
    expectTypeOf(options.generator.config.string).toEqualTypeOf<string | string[] | undefined>()
    assert.equal(options.generator.config.string, 'hello')

    expectTypeOf(options.generator.config.number).toEqualTypeOf<string | string[] | undefined>()
    assert.equal(options.generator.config.number, '10')

    expectTypeOf(options.generator.config.array).toEqualTypeOf<string | string[] | undefined>()
    assert.deepEqual(options.generator.config.array, ['a', 'b', 'c'])

    expectTypeOf(options.generator.config.other).toEqualTypeOf<string | string[] | undefined>()
    assert.equal(options.generator.config.other, undefined)

    return Promise.resolve()
  },
})

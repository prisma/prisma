import type { ExecutionMutationDefaultValue } from '@internal/contract/types';
import { describe, expect, it } from 'vitest';
import {
  assembleGeneratorFunctions,
  type GeneratorFunctionBinding,
  type GeneratorFunctionContribution,
  singleGeneratorBinding,
} from '../src/shared/generator-functions';

function fixedBinding(codecIds: readonly string[], generatorId: string): GeneratorFunctionBinding {
  return {
    codecIds,
    generatorIds: [generatorId],
    resolve: () => ({ ok: true, generator: { kind: 'generator', id: generatorId } }),
    printArguments: (generator) =>
      generator.id === generatorId ? { args: {}, text: '' } : undefined,
  };
}

function component(id: string, generatorFunctions: readonly GeneratorFunctionContribution[]) {
  return { id, generatorFunctions };
}

const textColumn = { codecId: 'text@1', typeParams: undefined };

describe('assembleGeneratorFunctions', () => {
  it('merges bindings that two components contribute for one function', () => {
    const registry = assembleGeneratorFunctions([
      component('family', [
        {
          name: 'uuid',
          signature: { documentation: 'uuid' },
          bindings: [fixedBinding(['char@1'], 'uuidv4')],
        },
      ]),
      component('target', [{ name: 'uuid', bindings: [fixedBinding(['text@1'], 'uuidv4')] }]),
    ]);

    expect({
      text: registry.resolve({ name: 'uuid', args: {}, column: textColumn }),
      char: registry.resolve({
        name: 'uuid',
        args: {},
        column: { codecId: 'char@1', typeParams: undefined },
      }),
    }).toEqual({
      text: { ok: true, generator: { kind: 'generator', id: 'uuidv4' } },
      char: { ok: true, generator: { kind: 'generator', id: 'uuidv4' } },
    });
  });

  it('lists only the functions bound to a codec, with their signatures', () => {
    const registry = assembleGeneratorFunctions([
      component('family', [
        {
          name: 'uuid',
          signature: { documentation: 'uuid' },
          bindings: [fixedBinding(['text@1'], 'uuidv4')],
        },
        {
          name: 'now',
          signature: { documentation: 'now' },
          bindings: [fixedBinding(['date@1'], 'dateNow')],
        },
      ]),
    ]);

    expect({
      text: registry.functionsFor('text@1'),
      date: registry.functionsFor('date@1'),
      bytes: registry.functionsFor('bytes@1'),
      has: [registry.has('uuid'), registry.has('foo')],
    }).toEqual({
      text: [{ name: 'uuid', signature: { documentation: 'uuid' } }],
      date: [{ name: 'now', signature: { documentation: 'now' } }],
      bytes: [],
      has: [true, false],
    });
  });

  it('reports an unknown function and a function not bound to the codec', () => {
    const registry = assembleGeneratorFunctions([
      component('family', [
        {
          name: 'uuid',
          signature: {},
          bindings: [fixedBinding(['text@1', 'char@1'], 'uuidv4')],
        },
      ]),
    ]);

    expect({
      unknown: registry.resolve({ name: 'foo', args: {}, column: textColumn }),
      notBound: registry.resolve({
        name: 'uuid',
        args: {},
        column: { codecId: 'bytes@1', typeParams: undefined },
      }),
    }).toEqual({
      unknown: { ok: false, reason: 'unknown-function', boundCodecIds: [] },
      notBound: { ok: false, reason: 'not-bound', boundCodecIds: ['char@1', 'text@1'] },
    });
  });

  it('reports a refusal from the binding', () => {
    const registry = assembleGeneratorFunctions([
      component('family', [
        {
          name: 'nanoid',
          signature: {},
          bindings: [
            {
              ...fixedBinding(['text@1'], 'nanoid'),
              resolve: () => ({ ok: false, message: 'too long' }),
            },
          ],
        },
      ]),
    ]);

    expect(registry.resolve({ name: 'nanoid', args: { size: 300 }, column: textColumn })).toEqual({
      ok: false,
      reason: 'refused',
      message: 'too long',
    });
  });

  it('writes the call that produces a generator, and nothing for a generator no function writes', () => {
    const registry = assembleGeneratorFunctions([
      component('family', [
        {
          name: 'uuid',
          signature: {},
          bindings: [
            {
              codecIds: ['text@1'],
              generatorIds: ['uuidv4', 'uuidv7'],
              resolve: () => ({ ok: true, generator: { kind: 'generator', id: 'uuidv4' } }),
              printArguments: (generator: ExecutionMutationDefaultValue) =>
                generator.id === 'uuidv7' ? { args: { version: 7 }, text: '7' } : undefined,
            },
          ],
        },
      ]),
    ]);

    expect({
      uuidv7: registry.callFor({ kind: 'generator', id: 'uuidv7' }, textColumn),
      uuidv4: registry.callFor({ kind: 'generator', id: 'uuidv4' }, textColumn),
      slugid: registry.callFor({ kind: 'generator', id: 'slugid' }, textColumn),
      otherCodec: registry.callFor(
        { kind: 'generator', id: 'uuidv7' },
        { codecId: 'bytes@1', typeParams: undefined },
      ),
    }).toEqual({
      uuidv7: { name: 'uuid', args: { version: 7 }, text: '7' },
      uuidv4: undefined,
      slugid: undefined,
      otherCodec: undefined,
    });
  });

  describe('refuses', () => {
    it('two components that declare a signature for one function', () => {
      expect(() =>
        assembleGeneratorFunctions([
          component('family', [{ name: 'uuid', signature: {}, bindings: [] }]),
          component('extension', [{ name: 'uuid', signature: {}, bindings: [] }]),
        ]),
      ).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
          message: 'Generator function "uuid" is declared by both "family" and "extension".',
        }),
      );
    });

    it('a binding for a function no component declares', () => {
      expect(() =>
        assembleGeneratorFunctions([
          component('extension', [
            { name: 'slugid', bindings: [fixedBinding(['text@1'], 'slugid')] },
          ]),
        ]),
      ).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
          message: '"extension" binds generator function "slugid", which no component declares.',
        }),
      );
    });

    it('two bindings of one function to one codec', () => {
      expect(() =>
        assembleGeneratorFunctions([
          component('family', [
            { name: 'uuid', signature: {}, bindings: [fixedBinding(['text@1'], 'uuidv4')] },
          ]),
          component('target', [{ name: 'uuid', bindings: [fixedBinding(['text@1'], 'uuidv4')] }]),
        ]),
      ).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
          message:
            'Generator function "uuid" is bound to codec "text@1" by both "family" and "target".',
        }),
      );
    });

    it('two functions that write one generator on one codec', () => {
      expect(() =>
        assembleGeneratorFunctions([
          component('family', [
            { name: 'uuid', signature: {}, bindings: [fixedBinding(['text@1'], 'uuidv4')] },
          ]),
          component('extension', [
            { name: 'guid', signature: {}, bindings: [fixedBinding(['text@1'], 'uuidv4')] },
          ]),
        ]),
      ).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
          message:
            'Generator "uuidv4" on codec "text@1" is written by both function "uuid" from "family" and function "guid" from "extension".',
        }),
      );
    });

    it('a binding that produces a generator the stack does not register', () => {
      expect(() =>
        assembleGeneratorFunctions(
          [
            component('extension', [
              { name: 'slugid', signature: {}, bindings: [fixedBinding(['text@1'], 'slugid')] },
            ]),
          ],
          { registeredGeneratorIds: new Set(['uuidv4']) },
        ),
      ).toThrow(
        expect.objectContaining({
          code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
          message:
            'Generator function "slugid" from "extension" produces generator "slugid", which no generator descriptor in the stack registers.',
        }),
      );
    });
  });
});

describe('singleGeneratorBinding', () => {
  const binding = singleGeneratorBinding({
    codecIds: ['time@1'],
    generatorId: 'timeNow',
    paramsFromColumn: (column) =>
      typeof column.typeParams?.['precision'] === 'number'
        ? { precision: column.typeParams['precision'] }
        : undefined,
  });

  it('resolves to its generator, with params from the column', () => {
    expect({
      withPrecision: binding.resolve({
        args: {},
        column: { codecId: 'time@1', typeParams: { precision: 3 } },
      }),
      without: binding.resolve({ args: {}, column: { codecId: 'time@1', typeParams: undefined } }),
    }).toEqual({
      withPrecision: {
        ok: true,
        generator: { kind: 'generator', id: 'timeNow', params: { precision: 3 } },
      },
      without: { ok: true, generator: { kind: 'generator', id: 'timeNow' } },
    });
  });

  it('writes no arguments for its generator and nothing for another', () => {
    const column = { codecId: 'time@1', typeParams: undefined };
    expect({
      own: binding.printArguments({ kind: 'generator', id: 'timeNow' }, column),
      other: binding.printArguments({ kind: 'generator', id: 'dateNow' }, column),
    }).toEqual({ own: { args: {}, text: '' }, other: undefined });
  });
});

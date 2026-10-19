import { assembleGeneratorFunctions } from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import {
  idGeneratorFunctionBindings,
  sqlFamilyGeneratorFunctions,
} from '../src/core/generator-functions';

const registry = assembleGeneratorFunctions([
  { id: 'sql', generatorFunctions: sqlFamilyGeneratorFunctions },
  {
    id: 'target',
    generatorFunctions: idGeneratorFunctionBindings({
      fixedLength: ['demo/char@1'],
      variableLength: ['demo/text@1', 'demo/varchar@1'],
      uuid: ['demo/uuid@1'],
    }),
  },
]);

function resolve(
  name: string,
  args: Record<string, unknown>,
  codecId: string,
  typeParams?: Record<string, unknown>,
) {
  return registry.resolve({ name, args, column: { codecId, typeParams } });
}

function generator(id: string, params?: Record<string, unknown>) {
  return {
    ok: true,
    generator: params === undefined ? { kind: 'generator', id } : { kind: 'generator', id, params },
  };
}

describe('SQL family generator functions', () => {
  it.each(['sql/char@1', 'sql/varchar@1', 'demo/char@1', 'demo/varchar@1', 'demo/text@1'])(
    'resolves every identifier function on %s',
    (codecId) => {
      const typeParams = codecId.endsWith('char@1') ? { length: 36 } : undefined;
      expect({
        uuid: resolve('uuid', {}, codecId, typeParams),
        uuid7: resolve('uuid', { version: 7 }, codecId, typeParams),
        cuid: resolve('cuid', { version: 2 }, codecId, typeParams),
        ulid: resolve('ulid', {}, codecId, typeParams),
        ksuid: resolve('ksuid', {}, codecId, typeParams),
        nanoid: resolve('nanoid', { size: 36 }, codecId, typeParams),
      }).toEqual({
        uuid: generator('uuidv4'),
        uuid7: generator('uuidv7'),
        cuid: generator('cuid2'),
        ulid: generator('ulid'),
        ksuid: generator('ksuid'),
        nanoid: generator('nanoid', { size: 36 }),
      });
    },
  );

  it('resolves uuid on a uuid codec, and not cuid', () => {
    expect({
      uuid: resolve('uuid', { version: 7 }, 'demo/uuid@1'),
      cuid: resolve('cuid', { version: 2 }, 'demo/uuid@1'),
    }).toEqual({
      uuid: generator('uuidv7'),
      cuid: {
        ok: false,
        reason: 'not-bound',
        boundCodecIds: [
          'demo/char@1',
          'demo/text@1',
          'demo/varchar@1',
          'sql/char@1',
          'sql/text@1',
          'sql/varchar@1',
        ],
      },
    });
  });

  it('declares now and binds it to no family codec', () => {
    expect({
      has: registry.has('now'),
      char: registry.functionsFor('sql/char@1').map((fn) => fn.name),
    }).toEqual({ has: true, char: ['cuid', 'ksuid', 'nanoid', 'ulid', 'uuid'] });
  });

  describe('nanoid on a fixed-length column', () => {
    it('takes its size from the length', () => {
      expect({
        char21: resolve('nanoid', {}, 'sql/char@1', { length: 21 }),
        char16: resolve('nanoid', {}, 'sql/char@1', { length: 16 }),
        explicit21: resolve('nanoid', { size: 21 }, 'sql/char@1', { length: 21 }),
      }).toEqual({
        char21: generator('nanoid'),
        char16: generator('nanoid', { size: 16 }),
        explicit21: generator('nanoid', { size: 21 }),
      });
    });

    it('refuses a size that differs from the length', () => {
      expect(resolve('nanoid', { size: 16 }, 'sql/char@1', { length: 21 })).toEqual({
        ok: false,
        reason: 'refused',
        message:
          'nanoid(16) on a Char(21) column would be padded with spaces; write nanoid() or nanoid(21).',
      });
    });
  });

  describe('nanoid on a variable-length column', () => {
    it('keeps the default size and does not read the length', () => {
      expect({
        varchar: resolve('nanoid', {}, 'sql/varchar@1', { length: 255 }),
        text: resolve('nanoid', {}, 'demo/text@1'),
      }).toEqual({ varchar: generator('nanoid'), text: generator('nanoid') });
    });

    it('refuses a size greater than the length', () => {
      expect({
        explicit: resolve('nanoid', { size: 32 }, 'sql/varchar@1', { length: 10 }),
        defaulted: resolve('nanoid', {}, 'sql/varchar@1', { length: 10 }),
      }).toEqual({
        explicit: {
          ok: false,
          reason: 'refused',
          message: 'nanoid(32) writes 32 characters, more than the VarChar(10) column holds.',
        },
        defaulted: {
          ok: false,
          reason: 'refused',
          message: 'nanoid() writes 21 characters, more than the VarChar(10) column holds.',
        },
      });
    });
  });

  it('checks the argument ranges', () => {
    expect({
      uuid: resolve('uuid', { version: 5 }, 'demo/text@1'),
      cuid: resolve('cuid', { version: 1 }, 'demo/text@1'),
      cuidMissing: resolve('cuid', {}, 'demo/text@1'),
      nanoidSmall: resolve('nanoid', { size: 1 }, 'demo/text@1'),
      nanoidLarge: resolve('nanoid', { size: 256 }, 'demo/text@1'),
      nanoidFraction: resolve('nanoid', { size: 2.5 }, 'demo/text@1'),
    }).toEqual({
      uuid: { ok: false, reason: 'refused', message: 'uuid takes version 4 or 7, not 5.' },
      cuid: { ok: false, reason: 'refused', message: 'cuid takes version 2, not 1.' },
      cuidMissing: {
        ok: false,
        reason: 'refused',
        message: 'cuid takes version 2, not undefined.',
      },
      nanoidSmall: {
        ok: false,
        reason: 'refused',
        message: 'nanoid takes a size from 2 through 255, not 1.',
      },
      nanoidLarge: {
        ok: false,
        reason: 'refused',
        message: 'nanoid takes a size from 2 through 255, not 256.',
      },
      nanoidFraction: {
        ok: false,
        reason: 'refused',
        message: 'nanoid takes a size from 2 through 255, not 2.5.',
      },
    });
  });

  it('writes the call for each identifier generator', () => {
    const text = { codecId: 'demo/text@1', typeParams: undefined };
    const char16 = { codecId: 'sql/char@1', typeParams: { length: 16 } };
    const char21 = { codecId: 'sql/char@1', typeParams: { length: 21 } };
    expect({
      uuidv4: registry.callFor({ kind: 'generator', id: 'uuidv4' }, text),
      uuidv7: registry.callFor({ kind: 'generator', id: 'uuidv7' }, text),
      cuid2: registry.callFor({ kind: 'generator', id: 'cuid2' }, text),
      ulid: registry.callFor({ kind: 'generator', id: 'ulid' }, text),
      ksuid: registry.callFor({ kind: 'generator', id: 'ksuid' }, text),
      nanoidText: registry.callFor({ kind: 'generator', id: 'nanoid', params: { size: 16 } }, text),
      nanoidChar16: registry.callFor(
        { kind: 'generator', id: 'nanoid', params: { size: 16 } },
        char16,
      ),
      nanoidChar21: registry.callFor(
        { kind: 'generator', id: 'nanoid', params: { size: 21 } },
        char21,
      ),
    }).toEqual({
      uuidv4: { name: 'uuid', args: {}, text: '' },
      uuidv7: { name: 'uuid', args: { version: 7 }, text: '7' },
      cuid2: { name: 'cuid', args: { version: 2 }, text: '2' },
      ulid: { name: 'ulid', args: {}, text: '' },
      ksuid: { name: 'ksuid', args: {}, text: '' },
      nanoidText: { name: 'nanoid', args: { size: 16 }, text: '16' },
      nanoidChar16: { name: 'nanoid', args: {}, text: '' },
      nanoidChar21: { name: 'nanoid', args: { size: 21 }, text: '21' },
    });
  });
});

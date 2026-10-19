import sqlFamilyPack from '@internal/family-sql/pack';
import { assembleGeneratorFunctions } from '@internal/framework-components/components';
import { describe, expect, it } from 'vitest';
import sqlitePack from '../src/exports/pack';

const registry = assembleGeneratorFunctions([sqlFamilyPack, sqlitePack]);

function resolve(name: string, codecId: string, args: Record<string, unknown> = {}) {
  return registry.resolve({ name, args }, { codecId, typeParams: undefined });
}

describe('the SQLite generator functions', () => {
  it('resolve now() on DateTime to timestampNow', () => {
    expect(resolve('now', 'sqlite/datetime@1')).toEqual({
      ok: true,
      generator: { kind: 'generator', id: 'timestampNow' },
    });
  });

  it('resolve uuid() on String', () => {
    expect({
      v4: resolve('uuid', 'sqlite/text@1'),
      v7: resolve('uuid', 'sqlite/text@1', { version: 7 }),
    }).toEqual({
      v4: { ok: true, generator: { kind: 'generator', id: 'uuidv4' } },
      v7: { ok: true, generator: { kind: 'generator', id: 'uuidv7' } },
    });
  });

  it('bind every identifier function to String', () => {
    expect(registry.functionsFor('sqlite/text@1').map((fn) => fn.name)).toEqual([
      'cuid',
      'ksuid',
      'nanoid',
      'ulid',
      'uuid',
    ]);
  });
});

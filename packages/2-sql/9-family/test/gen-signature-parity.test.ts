import { gen } from '@internal/framework-components/authoring';
import { assembleGeneratorFunctions } from '@internal/framework-components/control';
import type { FuncCallSig } from '@internal/psl-parser';
import { describe, expect, it } from 'vitest';
import { sqlFamilyGeneratorFunctions } from '../src/core/generator-functions';

const calls = [
  gen.now(),
  gen.uuid(),
  gen.uuid(7),
  gen.cuid(2),
  gen.ulid(),
  gen.nanoid(),
  gen.nanoid(16),
  gen.ksuid(),
];

function signatureKeys(name: string): readonly string[] {
  const contribution = sqlFamilyGeneratorFunctions.find((fn) => fn.name === name);
  const signature = contribution?.signature as FuncCallSig | undefined;
  return [
    ...(signature?.positional ?? []).map(({ key }) => key),
    ...Object.keys(signature?.named ?? {}),
  ];
}

describe('gen and the SQL family generator functions', () => {
  it('cover the same functions', () => {
    expect(Object.keys(gen).sort()).toEqual(
      sqlFamilyGeneratorFunctions.map(({ name }) => name).sort(),
    );
  });

  it.each(
    calls.map((call) => [`${call.name}(${Object.values(call.args).join(', ')})`, call] as const),
  )('%s passes only argument keys the PSL signature declares', (_label, call) => {
    expect(Object.keys(call.args).filter((key) => !signatureKeys(call.name).includes(key))).toEqual(
      [],
    );
  });

  it.each(
    calls
      .filter((call) => call.name !== 'now')
      .map((call) => [`${call.name}(${Object.values(call.args).join(', ')})`, call] as const),
  )('%s resolves on a column the function binds', (_label, call) => {
    const registry = assembleGeneratorFunctions([
      { id: 'sql', generatorFunctions: sqlFamilyGeneratorFunctions },
    ]);
    expect(
      registry.resolve({
        name: call.name,
        args: call.args,
        field: { codecId: 'sql/varchar@1', typeParams: { length: 64 } },
      }).ok,
    ).toBe(true);
  });
});

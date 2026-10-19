import { assembleGeneratorFunctions } from '@internal/framework-components/control';
import { describe, expect, it } from 'vitest';
import { mongoTargetDescriptorMeta } from '../src/core/descriptor-meta';

const registry = assembleGeneratorFunctions([mongoTargetDescriptorMeta], {
  registeredGeneratorIds: new Set(
    mongoTargetDescriptorMeta.controlMutationDefaults.generatorDescriptors.map(({ id }) => id),
  ),
});

describe('the Mongo generator functions', () => {
  it('resolve now() on DateTime to timestampNow', () => {
    expect(
      registry.resolve({
        name: 'now',
        args: {},
        column: { codecId: 'mongo/date@1', typeParams: undefined },
      }),
    ).toEqual({ ok: true, generator: { kind: 'generator', id: 'timestampNow' } });
  });

  it('bind only now', () => {
    expect(registry.functionsFor('mongo/date@1').map((fn) => fn.name)).toEqual(['now']);
  });
});

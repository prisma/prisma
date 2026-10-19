import { describe, expect, it } from 'vitest';
import type { CreateControlStackInput } from '../src/control/control-stack';
import { createControlStack } from '../src/control/control-stack';
import type { GeneratorFunctionContribution } from '../src/shared/generator-functions';

function stubInput(input: Record<string, unknown>): CreateControlStackInput {
  return input as unknown as CreateControlStackInput;
}

const slugid: GeneratorFunctionContribution = {
  name: 'slugid',
  signature: { documentation: 'slugid' },
  bindings: [
    {
      codecIds: ['text@1'],
      generatorIds: ['slugid'],
      resolve: () => ({ ok: true, generator: { kind: 'generator', id: 'slugid' } }),
      printArguments: () => ({ args: {}, text: '' }),
    },
  ],
};

function stackWith(generatorIds: readonly string[]) {
  return createControlStack(
    stubInput({
      family: { kind: 'family', id: 'family', version: '0.0.1' },
      target: { kind: 'target', id: 'target', version: '0.0.1' },
      adapter: {
        kind: 'adapter',
        id: 'adapter',
        version: '0.0.1',
        controlMutationDefaults: {
          defaultFunctionRegistry: new Map(),
          generatorDescriptors: generatorIds.map((id) => ({ id })),
        },
      },
      extensions: [
        { kind: 'extension', id: 'slugid-pack', version: '0.0.1', generatorFunctions: [slugid] },
      ],
    }),
  );
}

describe('createControlStack generator functions', () => {
  it('exposes the generator functions its components contribute', () => {
    const stack = stackWith(['slugid']);
    expect(
      stack.generatorFunctions.resolve(
        { name: 'slugid', args: {} },
        { codecId: 'text@1', typeParams: undefined },
      ),
    ).toEqual({ ok: true, generator: { kind: 'generator', id: 'slugid' } });
  });

  it('refuses an extension that registers a generator another component registers', () => {
    expect(() =>
      createControlStack(
        stubInput({
          family: {
            kind: 'family',
            id: 'sql',
            version: '0.0.1',
            controlMutationDefaults: {
              defaultFunctionRegistry: new Map(),
              generatorDescriptors: [{ id: 'uuidv4' }],
            },
          },
          target: { kind: 'target', id: 'target', version: '0.0.1' },
          extensions: [
            {
              kind: 'extension',
              id: 'uuid-codec-pack',
              version: '0.0.1',
              controlMutationDefaults: {
                defaultFunctionRegistry: new Map(),
                generatorDescriptors: [{ id: 'uuidv4' }],
              },
            },
          ],
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
        message:
          'Generator "uuidv4" is registered by both "sql" and "uuid-codec-pack". Register each generator once, in the component that defines it.',
      }),
    );
  });

  it('refuses a binding that produces a generator no component registers', () => {
    expect(() => stackWith(['uuidv4'])).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
        message:
          'Generator function "slugid" from "slugid-pack" produces generator "slugid", which no generator descriptor in the stack registers.',
      }),
    );
  });

  it('checks the registered generators in a stack with no adapter', () => {
    expect(() =>
      createControlStack(
        stubInput({
          family: { kind: 'family', id: 'family', version: '0.0.1' },
          target: { kind: 'target', id: 'target', version: '0.0.1' },
          extensions: [
            {
              kind: 'extension',
              id: 'slugid-pack',
              version: '0.0.1',
              generatorFunctions: [slugid],
            },
          ],
        }),
      ),
    ).toThrow(
      expect.objectContaining({
        code: 'CONTRACT.PACK_CONTRIBUTION_INVALID',
        message:
          'Generator function "slugid" from "slugid-pack" produces generator "slugid", which no generator descriptor in the stack registers.',
      }),
    );
  });
});

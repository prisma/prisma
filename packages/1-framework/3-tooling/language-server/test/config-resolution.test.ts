import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { pathToFileURL } from 'node:url';
import type { PrismaNextConfig } from '@prisma-next/config-loader';
import * as configLoader from '@prisma-next/config-loader';
import { errorUnexpected } from '@prisma-next/errors/control';
import type { AuthoringPslBlockDescriptorNamespace } from '@prisma-next/framework-components/authoring';
import type { ControlStack } from '@prisma-next/framework-components/control';
import * as control from '@prisma-next/framework-components/control';
import { timeouts } from '@repo/test-utils';
import { join } from 'pathe';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { resolveConfigInputs } from '../src/config-resolution';

vi.mock('@prisma-next/config-loader', { spy: true });
vi.mock('@prisma-next/framework-components/control', { spy: true });

function loadedConfig(format: string, inputs: readonly string[]): PrismaNextConfig {
  return { contract: { source: { format, inputs } } } as unknown as PrismaNextConfig;
}

function interpretCapableConfig(inputs: readonly string[]): PrismaNextConfig {
  return {
    contract: {
      source: {
        format: 'psl',
        inputs,
        load: async () => ({}) as never,
        interpret: () => ({}) as never,
      },
    },
  } as unknown as PrismaNextConfig;
}

function stubStackWithContext(): ControlStack {
  return {
    extensions: [{ id: 'ext-a' }, { id: 'ext-b' }],
    extensionContracts: new Map([['ext-a', { targetFamily: 'demo' }]]),
    scalarTypes: ['Int'],
    authoringContributions: {
      field: {},
      type: {
        Int: { kind: 'typeConstructor', output: { codecId: 'demo/int@1', nativeType: 'int' } },
      },
      entityTypes: {},
      pslBlockDescriptors: {},
      modelAttributes: {},
    },
    codecLookup: { get: () => undefined },
    controlMutationDefaults: {
      defaultFunctionRegistry: new Map(),
      generatorDescriptors: [],
    },
    capabilities: { demo: { scalarList: true } },
  } as unknown as ControlStack;
}

function stubStack(
  scalarTypes: readonly string[],
  pslBlockDescriptors: AuthoringPslBlockDescriptorNamespace,
): ControlStack {
  return {
    scalarTypes,
    authoringContributions: { pslBlockDescriptors },
  } as unknown as ControlStack;
}

describe('resolveConfigInputs', { timeout: timeouts.coldTransformImport }, () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('rejects when no config exists', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pn-lsp-noconfig-'));
    const configPath = join(root, 'prisma-next.config.ts');

    await expect(resolveConfigInputs(configPath)).rejects.toMatchObject({
      name: 'CliStructuredError',
      code: 'CONFIG.FILE_NOT_FOUND',
    });
  });

  it('rejects when the config is invalid', async () => {
    const root = await mkdtemp(join(tmpdir(), 'pn-lsp-badconfig-'));
    const configPath = join(root, 'prisma-next.config.ts');
    await writeFile(configPath, 'export default { family: {} };\n');

    await expect(resolveConfigInputs(configPath)).rejects.toMatchObject({
      name: 'CliStructuredError',
      code: 'CONFIG.VALIDATION_FAILED',
    });
  });

  it('re-throws unexpected structured errors', async () => {
    vi.spyOn(configLoader, 'loadConfig').mockRejectedValue(
      errorUnexpected('boom', { why: 'Failed to load config: boom' }),
    );
    const root = await mkdtemp(join(tmpdir(), 'pn-lsp-unexpected-'));
    const configPath = join(root, 'prisma-next.config.ts');

    await expect(resolveConfigInputs(configPath)).rejects.toMatchObject({
      name: 'CliStructuredError',
      code: 'CLI.UNEXPECTED',
    });
  });

  it('surfaces the control-stack-derived inputs for a psl config', async () => {
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue(
      loadedConfig('psl', ['/abs/schema.psl']),
    );
    vi.spyOn(control, 'createControlStack').mockReturnValue(stubStack(['Int'], {}));

    const result = await resolveConfigInputs('/abs/prisma-next.config.ts');

    expect(result.controlStack).toEqual({ scalarTypes: ['Int'], pslBlockDescriptors: {} });
    expect(result.inputs.includes(pathToFileURL('/abs/schema.psl').toString())).toBe(true);
  });
});

describe('control-stack input derivation', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('never builds a stack for a non-psl source and derives empty pipeline inputs', async () => {
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue(
      loadedConfig('typescript', ['/abs/schema.psl']),
    );
    const createControlStack = vi.spyOn(control, 'createControlStack');

    const result = await resolveConfigInputs('/abs/prisma-next.config.ts');

    expect(result.controlStack).toEqual({ scalarTypes: [], pslBlockDescriptors: {} });
    expect(createControlStack).not.toHaveBeenCalled();
  });

  it('derives control-stack scalarTypes and pslBlockDescriptors for a psl source', async () => {
    const pslBlockDescriptors: AuthoringPslBlockDescriptorNamespace = {
      enum: {
        kind: 'pslBlock',
        keyword: 'enum',
        discriminator: 'enum',
        name: { required: true },
        parameters: {},
        variadicParameters: true,
      },
    };
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue(
      loadedConfig('psl', ['/abs/schema.psl']),
    );
    vi.spyOn(control, 'createControlStack').mockReturnValue(
      stubStack(['Int', 'String'], pslBlockDescriptors),
    );

    const result = await resolveConfigInputs('/abs/prisma-next.config.ts');

    expect(result.controlStack).toEqual({ scalarTypes: ['Int', 'String'], pslBlockDescriptors });
  });

  it('propagates createControlStack failures for a psl source', async () => {
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue(
      loadedConfig('psl', ['/abs/schema.psl']),
    );
    vi.spyOn(control, 'createControlStack').mockImplementation(() => {
      throw new Error('boom');
    });

    await expect(resolveConfigInputs('/abs/prisma-next.config.ts')).rejects.toThrow('boom');
  });
});

describe('interpretation resolution', () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it('carries the guarded source and a stack-assembled context for a capable psl config', async () => {
    const config = interpretCapableConfig(['/abs/schema.prisma']);
    const stack = stubStackWithContext();
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue(config);
    vi.spyOn(control, 'createControlStack').mockReturnValue(stack);

    const result = await resolveConfigInputs('/abs/prisma-next.config.ts');

    expect(result.interpretation).toBeDefined();
    expect(result.interpretation?.source).toBe(config.contract?.source);
    const context = result.interpretation?.context;
    expect(context?.composedExtensions).toEqual(['ext-a', 'ext-b']);
    expect(context?.composedExtensionContracts).toBe(stack.extensionContracts);
    expect(context?.authoringContributions).toBe(stack.authoringContributions);
    expect(context?.codecLookup).toBe(stack.codecLookup);
    expect(context?.controlMutationDefaults).toBe(stack.controlMutationDefaults);
    expect(context?.capabilities).toBe(stack.capabilities);
    expect(context?.resolvedInputs).toEqual([pathToFileURL('/abs/schema.prisma').toString()]);
  });

  it('creates the control stack once per resolution', async () => {
    const config = interpretCapableConfig(['/abs/schema.prisma']);
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue(config);
    const createControlStack = vi
      .spyOn(control, 'createControlStack')
      .mockReturnValue(stubStackWithContext());

    await resolveConfigInputs('/abs/prisma-next.config.ts');

    expect(createControlStack).toHaveBeenCalledTimes(1);
  });

  it('carries no interpretation for a typescript source', async () => {
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue(
      loadedConfig('typescript', ['/abs/contract.ts']),
    );

    const result = await resolveConfigInputs('/abs/prisma-next.config.ts');

    expect(result.interpretation).toBeUndefined();
  });

  it('carries no interpretation for a psl source without the interpret capability', async () => {
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue(
      loadedConfig('psl', ['/abs/schema.prisma']),
    );
    vi.spyOn(control, 'createControlStack').mockReturnValue(stubStack(['Int'], {}));

    const result = await resolveConfigInputs('/abs/prisma-next.config.ts');

    expect(result.interpretation).toBeUndefined();
  });

  it('carries no interpretation when the config has no contract', async () => {
    vi.spyOn(configLoader, 'loadConfig').mockResolvedValue({} as unknown as PrismaNextConfig);

    const result = await resolveConfigInputs('/abs/prisma-next.config.ts');

    expect(result.interpretation).toBeUndefined();
  });
});

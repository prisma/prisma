import type { Contract } from '@internal/contract/types';
import type {
  ControlDriverInstance,
  ControlFamilyInstance,
} from '@internal/framework-components/control';
import { ok } from '@internal/utils/result';
import { isStructuredError } from '@internal/utils/structured-error';
import { describe, expect, it, vi } from 'vitest';
import { defineConfig, type PrismaNextConfig } from '../src/config-types';
import { validateConfig } from '../src/config-validation';

const mockHook = {
  id: 'sql',
  generateStorageType: () => '{}',
  generateModelStorageType: () => '{}',
  getFamilyImports: () => [] as string[],
  getFamilyTypeAliases: () => '',
  getTypeMapsExpression: () => 'never',
  getContractWrapper: (base: string, tm: string) =>
    `export type Contract = ${base} & { typeMaps: ${tm} };`,
};

function createSourceProvider(overrides: Record<string, unknown> = {}) {
  return {
    load: async () => ok({ targetFamily: 'sql' } as Contract),
    ...overrides,
  };
}

function createValidConfig(overrides: Record<string, unknown> = {}): PrismaNextConfig {
  return {
    family: {
      kind: 'family',
      id: 'sql',
      familyId: 'sql',
      version: '0.0.1',
      manifest: {},
      emission: mockHook,
      create: () => ({ familyId: 'sql' }) as unknown as ControlFamilyInstance<'sql', unknown>,
    },
    target: {
      kind: 'target',
      familyId: 'sql',
      targetId: 'postgres',
      id: 'postgres',
      version: '0.0.1',
      manifest: {},
      contractSerializer: {
        deserializeContract: (json) => json as never,
        serializeContract: (contract) => contract as never,
      },
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    },
    adapter: {
      kind: 'adapter',
      familyId: 'sql',
      targetId: 'postgres',
      id: 'postgres',
      version: '0.0.1',
      manifest: {},
      create: () => ({ familyId: 'sql', targetId: 'postgres' }),
    },
    driver: {
      kind: 'driver',
      familyId: 'sql',
      targetId: 'postgres',
      id: 'postgres',
      version: '0.0.1',
      manifest: {},
      create: async () =>
        ({
          familyId: 'sql',
          targetId: 'postgres',
          query: async () => ({ rows: [] }),
          close: async () => {},
        }) as ControlDriverInstance<'sql', 'postgres'>,
    },
    extensions: [],
    ...overrides,
  } as PrismaNextConfig;
}

type RawConfigOverrides = Record<string, unknown> & {
  family?: Record<string, unknown>;
  target?: Record<string, unknown>;
  adapter?: Record<string, unknown>;
  driver?: Record<string, unknown>;
};

function createValidRawConfig(overrides: RawConfigOverrides = {}) {
  const { family, target, adapter, driver, ...rest } = overrides;

  return {
    family: {
      kind: 'family',
      id: 'sql',
      familyId: 'sql',
      version: '0.0.1',
      manifest: {},
      emission: {},
      create: vi.fn(),
      ...(family as Record<string, unknown> | undefined),
    },
    target: {
      kind: 'target',
      familyId: 'sql',
      targetId: 'postgres',
      id: 'postgres',
      version: '0.0.1',
      manifest: {},
      create: vi.fn(),
      ...(target as Record<string, unknown> | undefined),
    },
    adapter: {
      kind: 'adapter',
      familyId: 'sql',
      targetId: 'postgres',
      id: 'postgres',
      version: '0.0.1',
      manifest: {},
      create: vi.fn(),
      ...(adapter as Record<string, unknown> | undefined),
    },
    driver: {
      kind: 'driver',
      familyId: 'sql',
      targetId: 'postgres',
      id: 'postgres',
      version: '0.0.1',
      manifest: {},
      create: vi.fn(),
      ...(driver as Record<string, unknown> | undefined),
    },
    ...rest,
  };
}

function expectFieldError(config: unknown, field: string) {
  try {
    validateConfig(config);
    throw new Error('expected validateConfig to throw');
  } catch (error) {
    expect(isStructuredError(error)).toBe(true);
    expect(error).toMatchObject({ code: 'CONFIG.VALIDATION_FAILED', meta: { field } });
  }
}

describe('validateConfig', () => {
  it('validates valid config', () => {
    expect(() => validateConfig(createValidRawConfig())).not.toThrow();
  });

  it('throws for non-object config', () => {
    expectFieldError(null, 'object');
    expectFieldError(undefined, 'object');
    expectFieldError('invalid', 'object');
  });

  it('throws when required top-level descriptors are missing', () => {
    expectFieldError({ target: {}, adapter: {} }, 'family');
    expectFieldError({ family: {}, adapter: {} }, 'target');
    expectFieldError({ family: {}, target: {} }, 'adapter');
  });

  it('validates family descriptor fields', () => {
    expectFieldError(createValidRawConfig({ family: { kind: 'invalid' } }), 'family.kind');
    expectFieldError(createValidRawConfig({ family: { id: 123 } }), 'family.id');
    expectFieldError(createValidRawConfig({ family: { familyId: 123 } }), 'family.familyId');
    expectFieldError(createValidRawConfig({ family: { version: 123 } }), 'family.version');
    expectFieldError(createValidRawConfig({ family: { emission: undefined } }), 'family.emission');
    expectFieldError(createValidRawConfig({ family: { create: 'invalid' } }), 'family.create');
  });

  it('validates target descriptor fields', () => {
    expectFieldError(createValidRawConfig({ target: { kind: 'invalid' } }), 'target.kind');
    expectFieldError(createValidRawConfig({ target: { id: 123 } }), 'target.id');
    expectFieldError(createValidRawConfig({ target: { familyId: 123 } }), 'target.familyId');
    expectFieldError(createValidRawConfig({ target: { version: 123 } }), 'target.version');
    expectFieldError(createValidRawConfig({ target: { targetId: 123 } }), 'target.targetId');
    expectFieldError(createValidRawConfig({ target: { create: 'invalid' } }), 'target.create');
  });

  it('validates target family compatibility', () => {
    expectFieldError(
      createValidRawConfig({
        family: { familyId: 'sql' },
        target: { familyId: 'document' },
      }),
      'target.familyId',
    );
  });

  it('validates adapter descriptor fields', () => {
    expectFieldError(createValidRawConfig({ adapter: { kind: 'invalid' } }), 'adapter.kind');
    expectFieldError(createValidRawConfig({ adapter: { id: 123 } }), 'adapter.id');
    expectFieldError(createValidRawConfig({ adapter: { familyId: 123 } }), 'adapter.familyId');
    expectFieldError(createValidRawConfig({ adapter: { version: 123 } }), 'adapter.version');
    expectFieldError(createValidRawConfig({ adapter: { targetId: 123 } }), 'adapter.targetId');
    expectFieldError(createValidRawConfig({ adapter: { create: 'invalid' } }), 'adapter.create');
  });

  it('validates adapter family and target compatibility', () => {
    expectFieldError(
      createValidRawConfig({
        family: { familyId: 'sql' },
        adapter: { familyId: 'document' },
      }),
      'adapter.familyId',
    );

    expectFieldError(
      createValidRawConfig({
        target: { targetId: 'postgres' },
        adapter: { targetId: 'mysql' },
      }),
      'adapter.targetId',
    );
  });

  it('validates extensions collection and extension descriptors', () => {
    expectFieldError(createValidRawConfig({ extensions: 'invalid' }), 'extensions');
    expectFieldError(createValidRawConfig({ extensions: ['invalid'] }), 'extensions[]');
    expectFieldError(
      createValidRawConfig({
        extensions: [{ kind: 'invalid', id: 'ext', familyId: 'sql', targetId: 'postgres' }],
      }),
      'extensions[].kind',
    );
    expectFieldError(
      createValidRawConfig({
        extensions: [{ kind: 'extension', id: 123, familyId: 'sql', targetId: 'postgres' }],
      }),
      'extensions[].id',
    );
    expectFieldError(
      createValidRawConfig({
        extensions: [{ kind: 'extension', id: 'ext', familyId: 123, targetId: 'postgres' }],
      }),
      'extensions[].familyId',
    );
    expectFieldError(
      createValidRawConfig({
        extensions: [{ kind: 'extension', id: 'ext', familyId: 'sql', version: 123 }],
      }),
      'extensions[].version',
    );
    expectFieldError(
      createValidRawConfig({
        extensions: [
          {
            kind: 'extension',
            id: 'ext',
            familyId: 'document',
            targetId: 'postgres',
            version: '0.0.1',
            create: vi.fn(),
          },
        ],
      }),
      'extensions[].familyId',
    );
    expectFieldError(
      createValidRawConfig({
        extensions: [
          {
            kind: 'extension',
            id: 'ext',
            familyId: 'sql',
            targetId: 123,
            version: '0.0.1',
            create: vi.fn(),
          },
        ],
      }),
      'extensions[].targetId',
    );
    expectFieldError(
      createValidRawConfig({
        extensions: [
          {
            kind: 'extension',
            id: 'ext',
            familyId: 'sql',
            targetId: 'mysql',
            version: '0.0.1',
            create: vi.fn(),
          },
        ],
      }),
      'extensions[].targetId',
    );
    expectFieldError(
      createValidRawConfig({
        extensions: [
          {
            kind: 'extension',
            id: 'ext',
            familyId: 'sql',
            targetId: 'postgres',
            version: '0.0.1',
            create: 'invalid',
          },
        ],
      }),
      'extensions[].create',
    );
  });

  it('accepts extensions key', () => {
    expect(() => validateConfig(createValidRawConfig({ extensions: [] }))).not.toThrow();
  });

  it('rejects removed extensionPacks key with a pointer to extensions', () => {
    try {
      validateConfig(createValidRawConfig({ extensionPacks: [] }));
      throw new Error('expected validateConfig to throw');
    } catch (error) {
      expect(isStructuredError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'CONFIG.VALIDATION_FAILED',
        meta: { field: 'extensionPacks' },
      });
      expect((error as Error).message).toContain('rename it to Config.extensions');
    }
  });

  it('validates driver descriptor fields and compatibility', () => {
    expectFieldError(createValidRawConfig({ driver: { kind: 'invalid' } }), 'driver.kind');
    expectFieldError(createValidRawConfig({ driver: { id: 123 } }), 'driver.id');
    expectFieldError(createValidRawConfig({ driver: { version: 123 } }), 'driver.version');
    expectFieldError(createValidRawConfig({ driver: { familyId: 123 } }), 'driver.familyId');
    expectFieldError(createValidRawConfig({ driver: { familyId: 'document' } }), 'driver.familyId');
    expectFieldError(createValidRawConfig({ driver: { targetId: 123 } }), 'driver.targetId');
    expectFieldError(createValidRawConfig({ driver: { targetId: 'mysql' } }), 'driver.targetId');
    expectFieldError(createValidRawConfig({ driver: { create: 'invalid' } }), 'driver.create');
  });

  it('validates contract shape and source provider', () => {
    expectFieldError(createValidRawConfig({ contract: 'invalid' }), 'contract');
    expectFieldError(createValidRawConfig({ contract: {} }), 'contract.source');
    const inheritedSourceContract = Object.create({
      source: createSourceProvider(),
    }) as Record<string, unknown>;
    expectFieldError(
      createValidRawConfig({ contract: inheritedSourceContract }),
      'contract.source',
    );
    const inheritedLoadSource = Object.create({
      load: async () => ok({ targetFamily: 'sql' } as Contract),
    }) as Record<string, unknown>;
    expectFieldError(
      createValidRawConfig({
        contract: {
          source: inheritedLoadSource,
        },
      }),
      'contract.source.load',
    );
    expectFieldError(
      createValidRawConfig({
        contract: {
          source: {
            inputs: 123,
            load: async () => ok({ targetFamily: 'sql' } as Contract),
          },
        },
      }),
      'contract.source.inputs',
    );
    expectFieldError(
      createValidRawConfig({
        contract: {
          source: {
            inputs: ['valid', 123],
            load: async () => ok({ targetFamily: 'sql' } as Contract),
          },
        },
      }),
      'contract.source.inputs[]',
    );
    expectFieldError(
      createValidRawConfig({
        contract: {
          source: {},
        },
      }),
      'contract.source.load',
    );
    expectFieldError(
      createValidRawConfig({
        contract: {
          source: {
            load: 'invalid',
          },
        },
      }),
      'contract.source.load',
    );
    const inheritedInputsSource = Object.create(
      {
        inputs: [123],
      },
      {
        load: {
          value: async () => ok({ targetFamily: 'sql' } as Contract),
          enumerable: true,
        },
      },
    ) as Record<string, unknown>;
    expect(() =>
      validateConfig(
        createValidRawConfig({
          contract: {
            source: inheritedInputsSource,
          },
        }),
      ),
    ).not.toThrow();
    expectFieldError(
      createValidRawConfig({
        contract: {
          source: createSourceProvider(),
          output: 123,
        },
      }),
      'contract.output',
    );
    const inheritedOutputContract = Object.create(
      {
        output: 123,
      },
      {
        source: {
          value: createSourceProvider(),
          enumerable: true,
        },
      },
    ) as Record<string, unknown>;
    expect(() =>
      validateConfig(createValidRawConfig({ contract: inheritedOutputContract })),
    ).not.toThrow();
  });

  it('accepts valid optional sections', () => {
    const config = createValidRawConfig({
      extensions: [
        {
          kind: 'extension',
          id: 'pgvector',
          familyId: 'sql',
          targetId: 'postgres',
          version: '0.0.1',
          manifest: {},
          create: vi.fn(),
        },
      ],
      contract: {
        source: createSourceProvider(),
        output: 'src/prisma/contract.json',
      },
    });
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('accepts descriptors without manifest fields', () => {
    const config = createValidRawConfig({
      family: { manifest: undefined },
      target: { manifest: undefined },
      adapter: { manifest: undefined },
      driver: { manifest: undefined },
      extensions: [
        {
          kind: 'extension',
          id: 'pgvector',
          familyId: 'sql',
          targetId: 'postgres',
          version: '0.0.1',
          manifest: undefined,
          create: vi.fn(),
        },
      ],
    });

    expect(() => validateConfig(config)).not.toThrow();
  });
});

describe('CONFIG.VALIDATION_FAILED structured error', () => {
  it('uses default message when why is omitted', () => {
    try {
      validateConfig({ target: {}, adapter: {} });
      throw new Error('expected validateConfig to throw');
    } catch (error) {
      expect(isStructuredError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'CONFIG.VALIDATION_FAILED',
        message: 'Config must have a "family" field',
        why: 'Config must have a "family" field',
        meta: { field: 'family' },
      });
    }
  });

  it('carries the explicit why as message when provided', () => {
    try {
      validateConfig('invalid');
      throw new Error('expected validateConfig to throw');
    } catch (error) {
      expect(isStructuredError(error)).toBe(true);
      expect(error).toMatchObject({
        code: 'CONFIG.VALIDATION_FAILED',
        message: 'Config must be an object',
        why: 'Config must be an object',
        meta: { field: 'object' },
      });
    }
  });
});

describe('defineConfig', () => {
  it('returns config unchanged when contract is absent', () => {
    const config = createValidConfig();
    const result = defineConfig(config);
    expect(result).toBe(config);
  });

  it('applies default output path when contract output is missing', () => {
    const config = createValidConfig({
      contract: {
        source: createSourceProvider(),
      },
    });

    const result = defineConfig(config);
    expect(result.contract?.output).toBe('src/prisma/contract.json');
  });

  it('preserves source provider metadata', () => {
    const config = createValidConfig({
      contract: {
        source: createSourceProvider({
          inputs: ['./schema.prisma'],
        }),
      },
    });

    const result = defineConfig(config);
    expect(result.contract).toBeDefined();
    expect(result.contract?.source.inputs).toEqual(['./schema.prisma']);
  });

  it('preserves custom output path', () => {
    const config = createValidConfig({
      contract: {
        source: createSourceProvider(),
        output: 'custom/contract.json',
      },
    });

    const result = defineConfig(config);
    expect(result.contract?.output).toBe('custom/contract.json');
  });

  it('throws when contract source is not a provider object', () => {
    const config = createValidConfig({
      contract: {
        source: 'invalid',
      },
    }) as unknown as PrismaNextConfig;

    expect(() => defineConfig(config)).toThrow('Config validation failed');
  });

  it('throws for invalid top-level shape', () => {
    const invalidConfig = { family: null } as unknown as PrismaNextConfig;
    try {
      defineConfig(invalidConfig);
      throw new Error('expected defineConfig to throw');
    } catch (error) {
      expect(isStructuredError(error)).toBe(true);
      expect(error).toMatchObject({ code: 'CONFIG.VALIDATION_FAILED' });
      expect((error as Error).message).toContain('Config validation failed');
    }
  });

  it('validates family create is function', () => {
    const config = createValidConfig({
      family: {
        kind: 'family',
        id: 'sql',
        familyId: 'sql',
        version: '0.0.1',
        manifest: {},
        emission: mockHook,
        create: vi.fn(),
      },
    });
    expect(() => validateConfig(config)).not.toThrow();
  });

  it('accepts a provider with an unknown format string', () => {
    const config = createValidConfig({
      contract: {
        source: createSourceProvider({ format: 'made-up-format' }),
      },
    });

    const result = defineConfig(config);
    expect(result.contract?.source.format).toBe('made-up-format');
  });

  it('rejects a non-string format', () => {
    const config = createValidConfig({
      contract: {
        source: createSourceProvider({ format: 123 }),
      },
    });

    expect(() => defineConfig(config)).toThrow('Config validation failed');
  });

  it('passes a provider carrying an extra interpret key through validation untouched', () => {
    const source = createSourceProvider({
      format: 'psl',
      inputs: ['./schema.prisma'],
      interpret: () => [],
    });
    const config = createValidConfig({ contract: { source } });

    const result = defineConfig(config);
    expect(result.contract?.source).toBe(source);
  });

  it('accepts the first-party psl and typescript provider shapes', () => {
    // Config (core) cannot import the authoring packages, so their provider shapes are mirrored here.
    const pslConfig = createValidConfig({
      contract: {
        source: createSourceProvider({ format: 'psl', inputs: ['./schema.prisma'] }),
      },
    });
    const typescriptConfig = createValidConfig({
      contract: {
        source: createSourceProvider({ format: 'typescript' }),
      },
    });

    expect(() => defineConfig(pslConfig)).not.toThrow();
    expect(() => defineConfig(typescriptConfig)).not.toThrow();
  });
});

describe('formatter section', () => {
  it('is optional', () => {
    const config = createValidConfig();
    expect(() => defineConfig(config)).not.toThrow();
  });

  it('accepts a numeric indent and an explicit newline', () => {
    const config = createValidConfig({
      formatter: { indent: 4, newline: 'CRLF' },
    });
    expect(() => defineConfig(config)).not.toThrow();
  });

  it('accepts a tab indent', () => {
    const config = createValidConfig({
      formatter: { indent: 'tab' },
    });
    expect(() => defineConfig(config)).not.toThrow();
  });

  it('accepts an empty formatter object', () => {
    const config = createValidConfig({
      formatter: {},
    });
    expect(() => defineConfig(config)).not.toThrow();
  });

  it('rejects a lowercase newline', () => {
    const config = createValidConfig({
      formatter: { newline: 'crlf' },
    }) as unknown as PrismaNextConfig;
    expect(() => defineConfig(config)).toThrow('Config validation failed');
  });

  it('rejects a zero indent', () => {
    const config = createValidConfig({
      formatter: { indent: 0 },
    });
    expect(() => defineConfig(config)).toThrow('Config validation failed');
  });

  it('rejects a negative indent', () => {
    const config = createValidConfig({
      formatter: { indent: -1 },
    });
    expect(() => defineConfig(config)).toThrow('Config validation failed');
  });

  it('rejects a non-integer indent', () => {
    const config = createValidConfig({
      formatter: { indent: 1.5 },
    });
    expect(() => defineConfig(config)).toThrow('Config validation failed');
  });

  it('rejects an unsupported indent literal', () => {
    const config = createValidConfig({
      formatter: { indent: 'spaces' },
    }) as unknown as PrismaNextConfig;
    expect(() => defineConfig(config)).toThrow('Config validation failed');
  });
});

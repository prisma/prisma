import type { Contract } from '@internal/contract/types';
import type {
  ControlDriverInstance,
  ControlFamilyInstance,
} from '@internal/framework-components/control';
import { ok } from '@internal/utils/result';
import { describe, expect, it } from 'vitest';
import {
  CONFIG_FORMAT_VERSION,
  defineConfig,
  hasCurrentConfigFormatVersion,
  type PrismaNextConfig,
  readConfigFormatVersion,
} from '../src/config-types';

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

describe('defineConfig', () => {
  it('returns the same object when contract is absent', () => {
    const config = createValidConfig();
    expect(defineConfig(config)).toBe(config);
  });

  it('applies default output path when contract output is missing', () => {
    const config = createValidConfig({
      contract: { source: createSourceProvider() },
    });

    const result = defineConfig(config);
    expect(result.contract?.output).toBe('src/prisma/contract.json');
  });

  it('preserves source provider metadata', () => {
    const config = createValidConfig({
      contract: { source: createSourceProvider({ inputs: ['./schema.prisma'] }) },
    });

    const result = defineConfig(config);
    expect(result.contract?.source.inputs).toEqual(['./schema.prisma']);
  });

  it('preserves custom output path', () => {
    const config = createValidConfig({
      contract: { source: createSourceProvider(), output: 'custom/contract.json' },
    });

    const result = defineConfig(config);
    expect(result.contract?.output).toBe('custom/contract.json');
  });

  it('does not validate structure — invalid shapes pass through for the loader to diagnose', () => {
    const invalidConfig = { family: null } as unknown as PrismaNextConfig;
    expect(() => defineConfig(invalidConfig)).not.toThrow();
  });
});

describe('config format version marker', () => {
  it('stamps the current format version on the result', () => {
    const result = defineConfig(createValidConfig());
    expect(readConfigFormatVersion(result)).toBe(CONFIG_FORMAT_VERSION);
    expect(hasCurrentConfigFormatVersion(result)).toBe(true);
  });

  it('stamps the normalized copy when contract is present', () => {
    const result = defineConfig(
      createValidConfig({ contract: { source: createSourceProvider() } }),
    );
    expect(hasCurrentConfigFormatVersion(result)).toBe(true);
  });

  it('keeps the marker out of enumeration and JSON serialization', () => {
    const result = defineConfig(createValidConfig());
    const markerSymbol = Symbol.for('prisma-next.config-format-version');
    expect(Object.getOwnPropertySymbols(result)).toContain(markerSymbol);
    expect(Object.getOwnPropertyDescriptor(result, markerSymbol)?.enumerable).toBe(false);
    expect(JSON.stringify({ marker: readConfigFormatVersion(result) })).toContain('1');
    expect(JSON.stringify(defineConfig(createValidConfig({ contract: undefined })))).not.toContain(
      'config-format-version',
    );
  });

  it('does not survive a spread — configs must export the defineConfig result directly', () => {
    const result = defineConfig(createValidConfig());
    const spread = { ...result };
    expect(hasCurrentConfigFormatVersion(spread)).toBe(false);
  });

  it('is idempotent when defineConfig wraps an already-stamped object', () => {
    const config = createValidConfig();
    const once = defineConfig(config);
    const twice = defineConfig(once);
    expect(hasCurrentConfigFormatVersion(twice)).toBe(true);
  });

  it('reports no version for plain objects and non-objects', () => {
    expect(readConfigFormatVersion({})).toBeUndefined();
    expect(readConfigFormatVersion(null)).toBeUndefined();
    expect(readConfigFormatVersion('config')).toBeUndefined();
    expect(hasCurrentConfigFormatVersion({})).toBe(false);
  });

  it('rejects a stale format version', () => {
    const stale = {};
    Object.defineProperty(stale, Symbol.for('prisma-next.config-format-version'), {
      value: CONFIG_FORMAT_VERSION - 1,
      enumerable: false,
    });
    expect(readConfigFormatVersion(stale)).toBe(CONFIG_FORMAT_VERSION - 1);
    expect(hasCurrentConfigFormatVersion(stale)).toBe(false);
  });
});

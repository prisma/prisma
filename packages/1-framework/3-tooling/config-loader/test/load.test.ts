import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findNearestConfigPathForFile, loadConfig, loadConfigForFile } from '../src/load';

// Temp-dir fixtures cannot import @internal/config, so they stamp the marker
// the same way defineConfig does: a non-enumerable well-known symbol.
const MARKER_STAMP = `
Object.defineProperty(config, Symbol.for('prisma-next.config-format-version'), {
  value: 1,
  enumerable: false,
});
export default config;
`;

const VALID_CONFIG_SOURCE =
  `
const descriptorBase = {
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  manifest: {},
};

const config = {
  family: {
    ...descriptorBase,
    kind: 'family',
    id: 'sql',
    emission: { id: 'sql' },
    create: () => ({ familyId: 'sql' }),
  },
  target: {
    ...descriptorBase,
    kind: 'target',
    id: 'postgres',
    create: () => ({ familyId: 'sql', targetId: 'postgres' }),
  },
  adapter: {
    ...descriptorBase,
    kind: 'adapter',
    id: 'postgres',
    create: () => ({ familyId: 'sql', targetId: 'postgres' }),
  },
  contract: {
    source: {
      inputs: ['./schema.prisma'],
      load: async () => ({ ok: true, value: { targetFamily: 'sql' } }),
    },
    output: './generated/contract.json',
  },
};
` + MARKER_STAMP;

const INVALID_CONFIG_SOURCE =
  `
const config = {
  family: { kind: 'family' },
};
` + MARKER_STAMP;

const UNMARKED_CONFIG_SOURCE = `
export default {
  family: { kind: 'family' },
};
`;

const EMPTY_CONFIG_SOURCE = `
export default {};
`;

describe('findNearestConfigPathForFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'prisma-8-config-path-for-file-')));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it('returns the nearest config path above the file', async () => {
    const appDir = join(tempDir, 'apps', 'shop');
    const schemaPath = join(appDir, 'prisma', 'schema.psl');
    const appConfigPath = join(appDir, 'prisma-next.config.ts');
    mkdirSync(join(appDir, 'prisma'), { recursive: true });
    writeFileSync(join(tempDir, 'prisma-next.config.ts'), VALID_CONFIG_SOURCE);
    writeFileSync(appConfigPath, INVALID_CONFIG_SOURCE);

    await expect(findNearestConfigPathForFile(schemaPath)).resolves.toBe(appConfigPath);
  });

  it('returns undefined when no config exists above the file', async () => {
    const schemaPath = join(tempDir, 'apps', 'shop', 'prisma', 'schema.psl');
    mkdirSync(join(tempDir, 'apps', 'shop', 'prisma'), { recursive: true });

    await expect(findNearestConfigPathForFile(schemaPath)).resolves.toBeUndefined();
  });
});

describe('loadConfigForFile', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'prisma-8-config-for-file-')));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  it(
    'loads the nearest config above the PSL file',
    async () => {
      const appDir = join(tempDir, 'apps', 'shop');
      const schemaPath = join(appDir, 'prisma', 'schema.psl');
      mkdirSync(join(appDir, 'prisma'), { recursive: true });
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), VALID_CONFIG_SOURCE);
      writeFileSync(join(appDir, 'prisma-next.config.ts'), VALID_CONFIG_SOURCE);

      const result = await loadConfigForFile(schemaPath);

      expect(result.ok).toBe(true);
      const { config, diagnostics } = result.assertOk();
      expect(diagnostics).toEqual([]);
      expect(config.contract?.source.inputs).toEqual([join(appDir, 'schema.prisma')]);
      expect(config.contract?.output).toBe(join(appDir, 'generated', 'contract.json'));
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'reports diagnostics from an invalid nearest config instead of falling back to a parent config',
    async () => {
      const appDir = join(tempDir, 'apps', 'shop');
      const schemaPath = join(appDir, 'prisma', 'schema.psl');
      mkdirSync(join(appDir, 'prisma'), { recursive: true });
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), VALID_CONFIG_SOURCE);
      writeFileSync(join(appDir, 'prisma-next.config.ts'), INVALID_CONFIG_SOURCE);

      const result = await loadConfigForFile(schemaPath);

      const { diagnostics } = result.assertOk();
      expect(diagnostics.length).toBeGreaterThan(0);
      expect(diagnostics[0]).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.VALIDATION_FAILED',
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a missing config above the PSL file to a structured config-file-not-found failure',
    async () => {
      const schemaPath = join(tempDir, 'apps', 'shop', 'prisma', 'schema.psl');
      mkdirSync(join(tempDir, 'apps', 'shop', 'prisma'), { recursive: true });

      const result = await loadConfigForFile(schemaPath);

      expect(result.assertNotOk()).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.FILE_NOT_FOUND',
      });
    },
    timeouts.typeScriptCompilation,
  );
});

describe('loadConfig', () => {
  let originalCwd: string;
  let tempDir: string;

  beforeEach(() => {
    originalCwd = process.cwd();
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'prisma-8-config-')));
  });

  afterEach(() => {
    process.chdir(originalCwd);
    rmSync(tempDir, { recursive: true, force: true });
  });

  it(
    'resolves inputs to absolute paths for a valid config',
    async () => {
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), VALID_CONFIG_SOURCE);
      process.chdir(tempDir);

      const result = await loadConfig();

      const { config, diagnostics } = result.assertOk();
      expect(diagnostics).toEqual([]);
      expect(config.contract?.source.inputs).toEqual([join(tempDir, 'schema.prisma')]);
      expect(config.contract?.output).toBe(join(tempDir, 'generated', 'contract.json'));
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'loads config without contract artifacts',
    async () => {
      const noContractSource = VALID_CONFIG_SOURCE.replace(
        `  contract: {
    source: {
      inputs: ['./schema.prisma'],
      load: async () => ({ ok: true, value: { targetFamily: 'sql' } }),
    },
    output: './generated/contract.json',
  },
`,
        '',
      );
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), noContractSource);
      process.chdir(tempDir);

      const result = await loadConfig();

      const { config, diagnostics } = result.assertOk();
      expect(diagnostics).toEqual([]);
      expect(config.contract).toBeUndefined();
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a missing config file to a structured config-file-not-found failure (CONFIG.FILE_NOT_FOUND)',
    async () => {
      const configPath = join(tempDir, 'nonexistent.config.ts');

      const result = await loadConfig(configPath);

      expect(result.assertNotOk()).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.FILE_NOT_FOUND',
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a missing config to CONFIG.FILE_NOT_FOUND when discovery from the cwd finds nothing',
    async () => {
      process.chdir(tempDir);

      const result = await loadConfig();

      expect(result.assertNotOk()).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.FILE_NOT_FOUND',
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a CONFIG.FILE_NOT_FOUND when c12 resolves to a different file than the requested path',
    async () => {
      writeFileSync(join(tempDir, 'custom.config.ts'), VALID_CONFIG_SOURCE);
      process.chdir(tempDir);

      const requestedPath = join(tempDir, 'custom.config');
      const result = await loadConfig('custom.config');

      expect(result.assertNotOk()).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.FILE_NOT_FOUND',
        where: { path: requestedPath },
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps an empty-object config to CONFIG.FILE_NOT_FOUND, reporting the discovered file path',
    async () => {
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), EMPTY_CONFIG_SOURCE);
      process.chdir(tempDir);

      const result = await loadConfig();

      expect(result.assertNotOk()).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.FILE_NOT_FOUND',
        where: { path: join(tempDir, 'prisma-next.config.ts') },
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'returns section-tagged diagnostics for an invalid config shape instead of failing the load',
    async () => {
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), INVALID_CONFIG_SOURCE);
      process.chdir(tempDir);

      const result = await loadConfig();

      const { diagnostics } = result.assertOk();
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'CONFIG.VALIDATION_FAILED',
          meta: { field: 'target', section: 'target' },
        }),
      );
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'CONFIG.VALIDATION_FAILED',
          meta: { field: 'adapter', section: 'adapter' },
        }),
      );
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'CONFIG.VALIDATION_FAILED',
          meta: { field: 'family.id', section: 'family' },
        }),
      );
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'reports an input/artifact collision as a contract-section diagnostic carrying the reason',
    async () => {
      const collidingSource = VALID_CONFIG_SOURCE.replace(
        "inputs: ['./schema.prisma']",
        "inputs: ['./generated/contract.json', './generated/contract.d.ts']",
      );
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), collidingSource);
      process.chdir(tempDir);

      const result = await loadConfig();

      const { diagnostics } = result.assertOk();
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'CONFIG.VALIDATION_FAILED',
          why: 'Config.contract.source.inputs must not include emitted artifact paths derived from contract.output',
          meta: { field: 'contract.source.inputs[]', section: 'contract' },
        }),
      );
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'reports a non-json contract output as a contract-section diagnostic from artifact path derivation',
    async () => {
      const nonJsonSource = VALID_CONFIG_SOURCE.replace(
        "output: './generated/contract.json'",
        "output: './generated/contract.ts'",
      );
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), nonJsonSource);
      process.chdir(tempDir);

      const result = await loadConfig();

      const { diagnostics } = result.assertOk();
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          code: 'CONFIG.VALIDATION_FAILED',
          why: 'Contract output path must end with .json',
          meta: { field: 'contract.output', section: 'contract' },
        }),
      );
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'skips contract finalization when the contract section has diagnostics',
    async () => {
      const brokenOutputSource = VALID_CONFIG_SOURCE.replace(
        "output: './generated/contract.json'",
        'output: 123',
      );
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), brokenOutputSource);
      process.chdir(tempDir);

      const result = await loadConfig();

      const { config, diagnostics } = result.assertOk();
      expect(diagnostics).toContainEqual(
        expect.objectContaining({
          meta: { field: 'contract.output', section: 'contract' },
        }),
      );
      expect(config.contract?.output).toBe(123 as unknown as string);
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'rejects a config without the defineConfig version marker (CONFIG.VERSION_MARKER_MISSING)',
    async () => {
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), UNMARKED_CONFIG_SOURCE);
      process.chdir(tempDir);

      const result = await loadConfig();

      expect(result.assertNotOk()).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.VERSION_MARKER_MISSING',
        where: { path: join(tempDir, 'prisma-next.config.ts') },
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'rejects a config carrying a stale format version (CONFIG.VERSION_MARKER_MISSING)',
    async () => {
      const staleSource = VALID_CONFIG_SOURCE.replace('value: 1,', 'value: 0,');
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), staleSource);
      process.chdir(tempDir);

      const result = await loadConfig();

      expect(result.assertNotOk()).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.VERSION_MARKER_MISSING',
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a c12 compilation failure to a structured evaluation failure (CONFIG.EVALUATION_FAILED)',
    async () => {
      const configPath = join(tempDir, 'prisma-next.config.ts');
      writeFileSync(configPath, 'export default { invalid syntax }', 'utf-8');

      const result = await loadConfig(configPath);

      expect(result.assertNotOk()).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.EVALUATION_FAILED',
        where: { path: configPath },
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a config module that throws during evaluation to CONFIG.EVALUATION_FAILED',
    async () => {
      const configPath = join(tempDir, 'prisma-next.config.ts');
      writeFileSync(configPath, "throw new Error('config module exploded');", 'utf-8');

      const result = await loadConfig(configPath);

      const failure = result.assertNotOk();
      expect(failure).toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.EVALUATION_FAILED',
      });
      expect(failure.why).toContain('config module exploded');
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a config module that throws during discovery from the cwd to CONFIG.EVALUATION_FAILED without a path',
    async () => {
      writeFileSync(
        join(tempDir, 'prisma-next.config.ts'),
        "throw new Error('config module exploded');",
        'utf-8',
      );
      process.chdir(tempDir);

      const failure = (await loadConfig()).assertNotOk();

      expect(failure.code).toBe('CONFIG.EVALUATION_FAILED');
      expect(failure.where).toBeUndefined();
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a config module that throws a non-Error value to CONFIG.EVALUATION_FAILED carrying its string form',
    async () => {
      const configPath = join(tempDir, 'prisma-next.config.ts');
      writeFileSync(configPath, "throw 'config module string failure';", 'utf-8');

      const failure = (await loadConfig(configPath)).assertNotOk();

      expect(failure.code).toBe('CONFIG.EVALUATION_FAILED');
      expect(failure.why).toContain('config module string failure');
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps an unresolvable import inside the config to CONFIG.FILE_NOT_FOUND',
    async () => {
      const configPath = join(tempDir, 'prisma-next.config.ts');
      writeFileSync(configPath, "import 'prisma-next-no-such-package';\n", 'utf-8');

      const failure = (await loadConfig(configPath)).assertNotOk();

      expect(failure.code).toBe('CONFIG.FILE_NOT_FOUND');
      expect(failure.where?.path).toBe(configPath);
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'passes a CliStructuredError thrown by the config module through unchanged',
    async () => {
      const configPath = join(tempDir, 'prisma-next.config.ts');
      writeFileSync(
        configPath,
        `
const error = new Error('driver descriptor rejected the connection');
Object.defineProperty(error, 'name', { value: 'CliStructuredError' });
error.code = 'CONFIG.VALIDATION_FAILED';
error.toEnvelope = () => ({ ok: false, code: error.code });
throw error;
`,
        'utf-8',
      );

      const failure = (await loadConfig(configPath)).assertNotOk();

      expect(failure.code).toBe('CONFIG.VALIDATION_FAILED');
      expect(failure.message).toBe('driver descriptor rejected the connection');
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'rewraps a plain structured error thrown by the config module, keeping its code and cause',
    async () => {
      const configPath = join(tempDir, 'prisma-next.config.ts');
      writeFileSync(
        configPath,
        `
const error = new Error('extension pack refused to load');
error.code = 'EXTENSION.LOAD_FAILED';
error.why = 'the pack entrypoint is missing';
error.fix = 'reinstall the extension package';
error.where = { path: 'extensions/pack.ts' };
error.meta = { pack: 'demo' };
throw error;
`,
        'utf-8',
      );

      const failure = (await loadConfig(configPath)).assertNotOk();

      expect(failure).toMatchObject({
        name: 'CliStructuredError',
        code: 'EXTENSION.LOAD_FAILED',
        message: 'extension pack refused to load',
        why: 'the pack entrypoint is missing',
        fix: 'reinstall the extension package',
        where: { path: 'extensions/pack.ts' },
        meta: { pack: 'demo' },
      });
      expect(failure.cause).toBeDefined();
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'reports no collision diagnostics when the contract declares no inputs',
    async () => {
      const noInputsSource = VALID_CONFIG_SOURCE.replace(
        "      inputs: ['./schema.prisma'],\n",
        '',
      );
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), noInputsSource);
      process.chdir(tempDir);

      const { config, diagnostics } = (await loadConfig()).assertOk();

      expect(diagnostics).toEqual([]);
      expect(config.contract?.source.inputs).toBeUndefined();
    },
    timeouts.typeScriptCompilation,
  );
});

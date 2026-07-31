import { mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { timeouts } from '@repo/test-utils';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { findNearestConfigPathForFile, loadConfig, loadConfigForFile } from '../src/load';

const VALID_CONFIG_SOURCE = `
const descriptorBase = {
  familyId: 'sql',
  targetId: 'postgres',
  version: '0.0.1',
  manifest: {},
};

export default {
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
`;

const INVALID_CONFIG_SOURCE = `
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
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'prisma-next-config-path-for-file-')));
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
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'prisma-next-config-for-file-')));
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

      const config = await loadConfigForFile(schemaPath);

      expect(config.contract?.source.inputs).toEqual([join(appDir, 'schema.prisma')]);
      expect(config.contract?.output).toBe(join(appDir, 'generated', 'contract.json'));
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'stops at an invalid nearest config instead of falling back to a parent config',
    async () => {
      const appDir = join(tempDir, 'apps', 'shop');
      const schemaPath = join(appDir, 'prisma', 'schema.psl');
      mkdirSync(join(appDir, 'prisma'), { recursive: true });
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), VALID_CONFIG_SOURCE);
      writeFileSync(join(appDir, 'prisma-next.config.ts'), INVALID_CONFIG_SOURCE);

      await expect(loadConfigForFile(schemaPath)).rejects.toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.VALIDATION_FAILED',
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a missing config above the PSL file to a structured config-file-not-found error',
    async () => {
      const schemaPath = join(tempDir, 'apps', 'shop', 'prisma', 'schema.psl');
      mkdirSync(join(tempDir, 'apps', 'shop', 'prisma'), { recursive: true });

      await expect(loadConfigForFile(schemaPath)).rejects.toMatchObject({
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
    tempDir = realpathSync(mkdtempSync(join(tmpdir(), 'prisma-next-config-')));
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

      const config = await loadConfig();

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

      const config = await loadConfig();

      expect(config.contract).toBeUndefined();
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a missing config file to a structured config-file-not-found error (CONFIG.FILE_NOT_FOUND)',
    async () => {
      const configPath = join(tempDir, 'nonexistent.config.ts');

      await expect(loadConfig(configPath)).rejects.toMatchObject({
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

      await expect(loadConfig()).rejects.toMatchObject({
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
      await expect(loadConfig('custom.config')).rejects.toMatchObject({
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

      await expect(loadConfig()).rejects.toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.FILE_NOT_FOUND',
        where: { path: join(tempDir, 'prisma-next.config.ts') },
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps an invalid config shape to a structured config-validation error (CONFIG.VALIDATION_FAILED)',
    async () => {
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), INVALID_CONFIG_SOURCE);
      process.chdir(tempDir);

      await expect(loadConfig()).rejects.toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.VALIDATION_FAILED',
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps an input/artifact collision to a structured validation error carrying the reason',
    async () => {
      const collidingSource = VALID_CONFIG_SOURCE.replace(
        "inputs: ['./schema.prisma']",
        "inputs: ['./generated/contract.json', './generated/contract.d.ts']",
      );
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), collidingSource);
      process.chdir(tempDir);

      await expect(loadConfig()).rejects.toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.VALIDATION_FAILED',
        why: 'Config.contract.source.inputs must not include emitted artifact paths derived from contract.output',
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'maps a non-json contract output to a structured validation error from artifact path derivation',
    async () => {
      const nonJsonSource = VALID_CONFIG_SOURCE.replace(
        "output: './generated/contract.json'",
        "output: './generated/contract.ts'",
      );
      writeFileSync(join(tempDir, 'prisma-next.config.ts'), nonJsonSource);
      process.chdir(tempDir);

      await expect(loadConfig()).rejects.toMatchObject({
        name: 'CliStructuredError',
        code: 'CONFIG.VALIDATION_FAILED',
        why: 'Contract output path must end with .json',
      });
    },
    timeouts.typeScriptCompilation,
  );

  it(
    'wraps a c12 compilation failure in a structured unexpected error (CLI.UNEXPECTED)',
    async () => {
      const configPath = join(tempDir, 'prisma-next.config.ts');
      writeFileSync(configPath, 'export default { invalid syntax }', 'utf-8');

      await expect(loadConfig(configPath)).rejects.toMatchObject({
        name: 'CliStructuredError',
        code: 'CLI.UNEXPECTED',
      });
    },
    timeouts.typeScriptCompilation,
  );
});

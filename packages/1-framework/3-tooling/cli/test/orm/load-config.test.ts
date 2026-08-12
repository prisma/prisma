import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { loadOrmConfig } from '../../src/orm/load-config';

const created: string[] = [];

function projectDir(): string {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'orm-config-')));
  created.push(dir);
  return dir;
}

/**
 * Written without importing the workspace, so the fixture evaluates from a
 * throwaway directory that has no `node_modules`. The version marker is the
 * same non-enumerable symbol `defineConfig` stamps.
 */
function configModule(body: string): string {
  return [
    `const config = ${body};`,
    `Object.defineProperty(config, Symbol.for('prisma-next.config-format-version'), {`,
    '  value: 1,',
    '  enumerable: false,',
    '});',
    'export default config;',
  ].join('\n');
}

const DESCRIPTOR = `{ kind: 'target', id: 'target-id', familyId: 'sql', targetId: 'postgres', version: '1.0.0', create: () => ({}) }`;

const VALID_BODY = `{
  family: { kind: 'family', id: 'sql', familyId: 'sql', version: '1.0.0', emission: {}, create: () => ({}) },
  target: ${DESCRIPTOR},
  adapter: { ...${DESCRIPTOR}, kind: 'adapter' },
  contract: { source: { format: 'psl', inputs: ['contract.prisma'], load: () => ({}) }, output: 'output/contract.json' },
}`;

function writeConfig(dir: string, body: string, fileName = 'prisma-next.config.ts'): void {
  writeFileSync(join(dir, fileName), configModule(body), 'utf-8');
}

afterEach(() => {
  for (const dir of created.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('loadOrmConfig', () => {
  it('nests the whole configuration under the orm section', async () => {
    const dir = projectDir();
    writeConfig(dir, VALID_BODY);

    const loaded = await loadOrmConfig({ cwd: dir });

    expect(loaded.diagnostics).toEqual([]);
    expect(Object.keys(loaded.sections)).toEqual(['orm']);
  });

  it('finalizes contract paths against the config file directory', async () => {
    const dir = projectDir();
    writeConfig(dir, VALID_BODY);

    const loaded = await loadOrmConfig({ cwd: dir });
    const orm = loaded.sections['orm'] as {
      contract?: { output?: string; source?: { inputs?: readonly string[] } };
    };

    expect(orm.contract?.output).toBe(join(dir, 'output/contract.json'));
    expect(orm.contract?.source?.inputs).toEqual([join(dir, 'contract.prisma')]);
  });

  it('discovers the config in the supplied cwd rather than the process cwd', async () => {
    const dir = projectDir();
    writeConfig(dir, VALID_BODY);

    expect(dir).not.toBe(process.cwd());
    expect((await loadOrmConfig({ cwd: dir })).sections['orm']).toBeDefined();
  });

  it('reads an explicit config path relative to the cwd', async () => {
    const dir = projectDir();
    writeConfig(dir, VALID_BODY, 'custom.config.ts');

    const loaded = await loadOrmConfig({ cwd: dir, configPath: 'custom.config.ts' });

    expect(loaded.diagnostics).toEqual([]);
    expect(loaded.sections['orm']).toBeDefined();
  });

  describe('a config that cannot be evaluated', () => {
    it('reports a file-level diagnostic and no sections', async () => {
      const loaded = await loadOrmConfig({ cwd: projectDir() });

      expect(loaded.sections).toEqual({});
      expect(loaded.diagnostics).toHaveLength(1);
      expect(loaded.diagnostics[0]?.section).toBeNull();
      expect(loaded.diagnostics[0]?.diagnostic).toMatchObject({
        code: 'CONFIG.FILE_NOT_FOUND',
        severity: 'error',
      });
    });

    it('gives the file-level diagnostic typed next actions', async () => {
      const loaded = await loadOrmConfig({ cwd: projectDir() });

      expect(loaded.diagnostics[0]?.diagnostic.nextActions).toEqual([
        { kind: 'user-choice', label: "Run 'prisma-next init' to create a config file" },
      ]);
    });

    it('turns a config module that throws while evaluating into a diagnostic', async () => {
      const dir = projectDir();
      writeFileSync(
        join(dir, 'prisma-next.config.ts'),
        "throw new Error('boom while importing');",
        'utf-8',
      );

      const loaded = await loadOrmConfig({ cwd: dir });

      expect(loaded.sections).toEqual({});
      expect(loaded.diagnostics).toHaveLength(1);
      expect(loaded.diagnostics[0]).toMatchObject({ section: null });
      expect(loaded.diagnostics[0]?.diagnostic.code).toMatch(/^[A-Z][A-Z0-9]*\.[A-Z][A-Z0-9_]*$/);
    });

    it('reports a missing version marker as file-level', async () => {
      const dir = projectDir();
      writeFileSync(join(dir, 'prisma-next.config.ts'), 'export default { family: {} };', 'utf-8');

      const loaded = await loadOrmConfig({ cwd: dir });

      expect(loaded.sections).toEqual({});
      expect(loaded.diagnostics[0]).toMatchObject({
        section: null,
        diagnostic: { code: 'CONFIG.VERSION_MARKER_MISSING' },
      });
    });
  });

  describe('a structurally invalid config that still evaluates', () => {
    it('leaves the structural verdict to the section validator', async () => {
      const dir = projectDir();
      writeConfig(dir, '{ migrations: { dir: 42 } }');

      const loaded = await loadOrmConfig({ cwd: dir });

      expect(loaded.diagnostics).toEqual([]);
      expect(loaded.sections['orm']).toMatchObject({ migrations: { dir: 42 } });
    });
  });
});

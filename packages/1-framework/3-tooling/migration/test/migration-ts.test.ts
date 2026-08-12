import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { writeMigrationTs } from '../src/migration-ts';

const isPosix = process.platform !== 'win32';

describe('writeMigrationTs', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'write-migration-ts-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('writes the rendered content after passing it through prettier', async () => {
    // Rendered source often comes in with loose spacing from a programmatic
    // composer (e.g. the migration renderer). `writeMigrationTs` runs it
    // through prettier so the on-disk file is canonically formatted — this
    // test locks that behaviour by giving it a deliberately under-quoted
    // statement and asserting the written file uses the house single-quote
    // style.
    const content = '#!/usr/bin/env -S node\nconsole.log("hi");\n';
    await writeMigrationTs(tmpDir, content);

    const written = await readFile(join(tmpDir, 'migration.ts'), 'utf-8');
    expect(written.startsWith('#!/usr/bin/env -S node')).toBe(true);
    expect(written).toContain("console.log('hi');");
  });

  it.skipIf(!isPosix)('sets the executable bit when content starts with a shebang', async () => {
    const content = '#!/usr/bin/env -S node\nexport default () => [];\n';
    await writeMigrationTs(tmpDir, content);

    const s = await stat(join(tmpDir, 'migration.ts'));
    const mode = s.mode & 0o777;
    expect(mode & 0o100).toBe(0o100);
  });

  it.skipIf(!isPosix)('does not set the executable bit when content has no shebang', async () => {
    const content = 'export default () => [];\n';
    await writeMigrationTs(tmpDir, content);

    const s = await stat(join(tmpDir, 'migration.ts'));
    const mode = s.mode & 0o777;
    expect(mode & 0o100).toBe(0);
  });
});

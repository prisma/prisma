import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, describe, expect, it } from 'vitest';
import { createTestSqlNamespace } from '../../../1-core/contract/test/test-support';
import { prismaContract } from '../src/exports/provider';
import { createPostgresTestContext, postgresTarget } from './fixtures';

describe('prismaContract given a mixin written without its block keyword', () => {
  const tempDirs: string[] = [];

  afterEach(async () => {
    for (const dir of tempDirs) {
      await rm(dir, { recursive: true, force: true });
    }
    tempDirs.length = 0;
  });

  async function diagnosticsOf(schema: string) {
    const tempDir = await mkdtemp(join(tmpdir(), 'psl-provider-mixin-'));
    tempDirs.push(tempDir);
    const schemaPath = join(tempDir, 'schema.prisma');
    await writeFile(schemaPath, `// use prisma-8\n${schema}`, 'utf-8');
    const result = await prismaContract('./schema.prisma', {
      target: postgresTarget,
      createNamespace: createTestSqlNamespace,
    }).source.load({ ...createPostgresTestContext(), resolvedInputs: [schemaPath] });
    return (result.ok ? [] : result.failure.diagnostics).map(({ code, message, span }) => ({
      code,
      message,
      line: span?.start.line,
    }));
  }

  const model = ['', 'model User {', '  id Int @id', '  +Timestamps', '}'];

  it('reports the declaration and the inclusion, and no unsupported block', async () => {
    expect(
      await diagnosticsOf(['mixin Timestamps {', '  createdAt DateTime', '}', ...model].join('\n')),
    ).toEqual([
      {
        code: 'PSL_INVALID_DECLARATION',
        message:
          'A mixin starts with the keyword of the block it is for, for example "model mixin Timestamps"',
        line: 2,
      },
      { code: 'PSL_UNRESOLVED_REFERENCE', message: 'Cannot find mixin "Timestamps"', line: 8 },
    ]);
  });

  it('reports a body line that is not a block entry as well', async () => {
    expect(
      await diagnosticsOf(
        ['mixin Timestamps {', '  createdAt DateTime @default(now())', '}', ...model].join('\n'),
      ),
    ).toEqual([
      { code: 'PSL_INVALID_EXTENSION_BLOCK_MEMBER', message: 'Invalid block entry', line: 3 },
      {
        code: 'PSL_INVALID_DECLARATION',
        message:
          'A mixin starts with the keyword of the block it is for, for example "model mixin Timestamps"',
        line: 2,
      },
      { code: 'PSL_UNRESOLVED_REFERENCE', message: 'Cannot find mixin "Timestamps"', line: 8 },
    ]);
  });

  it('reports a declaration with no body', async () => {
    expect(await diagnosticsOf(['mixin Timestamps', ...model].join('\n'))).toEqual([
      {
        code: 'PSL_INVALID_DECLARATION',
        message: 'Expected "{" to open the "mixin" block',
        line: 2,
      },
      {
        code: 'PSL_INVALID_DECLARATION',
        message:
          'A mixin starts with the keyword of the block it is for, for example "model mixin Name"',
        line: 2,
      },
      { code: 'PSL_UNRESOLVED_REFERENCE', message: 'Cannot find mixin "Timestamps"', line: 6 },
    ]);
  });

  it('reports a mixin whose block keyword is mixin', async () => {
    expect(await diagnosticsOf(['mixin mixin Timestamps {', '}', ...model].join('\n'))).toEqual([
      {
        code: 'PSL_INVALID_DECLARATION',
        message:
          'A mixin starts with the keyword of the block it is for, for example "model mixin Timestamps"',
        line: 2,
      },
      { code: 'PSL_UNRESOLVED_REFERENCE', message: 'Cannot find mixin "Timestamps"', line: 7 },
    ]);
  });
});

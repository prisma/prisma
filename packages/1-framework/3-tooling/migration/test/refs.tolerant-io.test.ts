import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'pathe';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { readRefsTolerant } from '../src/refs';

describe('readRefsTolerant', () => {
  let refsDir: string;

  beforeEach(async () => {
    refsDir = await mkdtemp(join(tmpdir(), 'refs-tolerant-io-'));
  });

  afterEach(async () => {
    await rm(refsDir, { recursive: true, force: true });
  });

  it('returns empty refs when the refs directory is missing', async () => {
    const missingDir = join(refsDir, 'no-such-refs');
    const result = await readRefsTolerant(missingDir);
    expect(result.refs).toEqual({});
    expect(result.problems).toEqual([]);
  });

  it('tolerates invalid JSON as a ref load problem', async () => {
    await writeFile(join(refsDir, 'broken.json'), 'not json');

    const result = await readRefsTolerant(refsDir);
    expect(result.refs).toEqual({});
    expect(result.problems).toHaveLength(1);
    expect(result.problems[0]?.refName).toBe('broken');
  });
});

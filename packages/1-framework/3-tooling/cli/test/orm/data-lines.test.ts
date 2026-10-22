import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'pathe';
import { describe, expect, it } from 'vitest';
import { dataLine, showLines } from '../../src/orm/data-lines';

const ORM_COMMANDS_DIR = join(import.meta.dirname, '../../src/orm');

function sourceFiles(dir: string): readonly string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith('.ts') ? [path] : [];
  });
}

describe('dataLine', () => {
  it('joins fields with tabs and keeps an absent field as an empty one', () => {
    expect(dataLine(['app', null, 'sha256:b', 3, undefined, true])).toBe(
      'app\t\tsha256:b\t3\t\ttrue',
    );
  });
});

describe('showLines', () => {
  it('writes one key-tab-value line per present field, in order', () => {
    expect(
      showLines([
        ['name', '20260101T1000_init'],
        ['from', null],
        ['to', 'sha256:b'],
        ['operations', 2],
      ]),
    ).toEqual(['name\t20260101T1000_init', 'to\tsha256:b', 'operations\t2']);
  });
});

describe('ORM command stdout', () => {
  it('says why when a command has no data lines', () => {
    const silent = sourceFiles(ORM_COMMANDS_DIR)
      .filter((path) => /stdout:\s*\(\)\s*=>\s*\[\s*\]/.test(readFileSync(path, 'utf-8')))
      .map((path) => relative(ORM_COMMANDS_DIR, path));

    expect(silent).toEqual([]);
  });
});

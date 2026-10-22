import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');

function changeBlock(audience: string, id: string): string {
  const guide = readFileSync(
    join(
      repoRoot,
      'upgrade-instructions/pending/cli-engine-0-9-piped-output',
      audience,
      'instructions.md',
    ),
    'utf-8',
  );
  const frontmatter = guide.split('\n---\n')[0] ?? '';
  const block = frontmatter.split(/\n {2}- id: /).find((entry) => entry.startsWith(`${id}\n`));
  if (block === undefined) {
    throw new Error(`${audience} guide has no change ${id}`);
  }
  return block;
}

function patternsOf(audience: string, id: string): readonly RegExp[] {
  return [...changeBlock(audience, id).matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
}

const manifest = (engine: string) =>
  JSON.stringify({ devDependencies: { '@prisma/cli-engine': engine } }, null, 2);

describe.each(['app', 'extension'])('the %s cli-engine 0.9.0 detection', (audience) => {
  const matches = (content: string) =>
    patternsOf(audience, 'engine-pin-moves-to-0-9-0').some((pattern) => pattern.test(content));

  it('matches an engine pin or range below 0.9', () => {
    expect(['0.7.0', '^0.7.0', '~0.7.0', '0.2.3', '^0.8.1'].map(manifest).map(matches)).toEqual([
      true,
      true,
      true,
      true,
      true,
    ]);
  });

  it('does not match 0.9.0 or later', () => {
    expect(['0.9.0', '^0.9.0', '0.10.0', '1.0.0'].map(manifest).map(matches)).toEqual([
      false,
      false,
      false,
      false,
    ]);
  });

  it('does not match a manifest without the engine', () => {
    expect(matches(JSON.stringify({ dependencies: { '@prisma/cli': '0.7.0' } }))).toBe(false);
  });

  it('shows the piped-output instruction to every project', () => {
    expect(changeBlock(audience, 'piped-output-needs-json')).not.toContain('detection:');
  });
});

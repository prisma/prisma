import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const GUIDE_PATHS = {
  app: 'skills/prisma-8/upgrading/app/upgrades/8.0.0-rc.18-to-8.0.0-rc.19/instructions.md',
  extension:
    'skills/prisma-8/upgrading/extension/upgrades/8.0.0-rc.18-to-8.0.0-rc.19/instructions.md',
} as const;

const here = dirname(fileURLToPath(import.meta.url));

function entryOf(audience: keyof typeof GUIDE_PATHS): string {
  const guide = readFileSync(join(here, '../../../../..', GUIDE_PATHS[audience]), 'utf-8');
  const entry = guide
    .split(/\n {2}- id: /)
    .find((block) => block.startsWith('runner-failures-report-own-codes\n'));
  if (entry === undefined)
    throw new Error(`The ${audience} guide has no runner-failures-report-own-codes`);
  return entry;
}

function detects(audience: keyof typeof GUIDE_PATHS, content: string): boolean {
  return [...entryOf(audience).matchAll(/^ {8}- '(.*)'$/gm)]
    .map(([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")))
    .some((pattern) => pattern.test(content));
}

describe.each(['app', 'extension'] as const)(
  '%s runner-failures-report-own-codes detection',
  (audience) => {
    it('reads only code and shell files', () => {
      expect(/^ {6}glob: "(.*)"$/m.exec(entryOf(audience))?.[1]).toBe(
        '**/*.{ts,tsx,mts,cts,js,mjs,cjs,sh}',
      );
    });

    it.each([
      ['the dotted code', "if (error.code === 'MIGRATION.RUNNER_FAILED') retry();"],
      ['the meta key', 'report(error.meta.runnerErrorCode);'],
    ])('finds %s', (_name, content) => {
      expect(detects(audience, content)).toBe(true);
    });

    it('skips a code of the same name in another namespace', () => {
      expect(detects(audience, "throw new AppError('RUNNER_FAILED', message);")).toBe(false);
    });
  },
);

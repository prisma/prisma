import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'pathe';
import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(here, '../../../../..');

function detectionOf(audience: 'app' | 'extension', id: string): readonly RegExp[] {
  const guide = readFileSync(
    join(
      repoRoot,
      'upgrade-instructions/pending/data-typed-constructor-arguments',
      audience,
      'instructions.md',
    ),
    'utf-8',
  );
  const entry = guide.split(/\n {2}- id: /).find((block) => block.startsWith(`${id}\n`));
  if (entry === undefined) throw new Error(`The ${audience} fragment has no change ${id}`);
  return [...entry.matchAll(/^ {8}- '(.*)'$/gm)].map(
    ([, pattern]) => new RegExp((pattern ?? '').replaceAll("''", "'")),
  );
}

function detects(audience: 'app' | 'extension', id: string, content: string): boolean {
  return detectionOf(audience, id).some((pattern) => pattern.test(content));
}

describe('app detection of type-constructor arguments that are now refused', () => {
  it.each([
    'name VarChar("255")',
    'name VarChar(length: "255")',
    'price Numeric(10, "2")',
    'name VarChar(255.0)',
    'price Numeric(10.00, 2)',
    'created Timestamptz(3.0)',
    'name sql.String(2.0)',
    'created temporal.timestamp("3")',
    'created temporal.timestamp(3.0)',
  ])('detects %s', (line) => {
    expect(detects('app', 'type-constructor-arguments-are-values', line)).toBe(true);
  });

  it.each([
    'name VarChar(255)',
    'name VarChar(length: 255)',
    'price Numeric(10, 2)',
    'created temporal.timestamp(3)',
    'ratio Float @default(1.0)',
    'name String @default("255")',
    'name String @map("2.0")',
  ])('does not detect %s', (line) => {
    expect(detects('app', 'type-constructor-arguments-are-values', line)).toBe(false);
  });
});

describe('app detection of raw columns written with a string', () => {
  it.each(['search Raw("tsvector")', "field.column(rawColumn('tsvector'))"])(
    'detects %s',
    (line) => {
      expect(detects('app', 'raw-columns-take-a-sql-literal', line)).toBe(true);
    },
  );

  it.each(['search Raw(sql`tsvector`)', 'field.column(rawColumn(sql`tsvector`))'])(
    'does not detect %s',
    (line) => {
      expect(detects('app', 'raw-columns-take-a-sql-literal', line)).toBe(false);
    },
  );
});

describe('extension detection', () => {
  it.each([
    ['psl-and-print-helpers-take-data-types', "import { assembleAuthoringDataTypes } from 'x';"],
    ['psl-and-print-helpers-take-data-types', 'temporalCodecPresetWithPrecision({ codecId })'],
    [
      'composed-helpers-take-no-data-type-lookup',
      'createComposedAuthoringHelpers({ family, target, codecLookup, dataTypeLookup })',
    ],
    ['helper-codec-invariants', 'enforceDataTypeInvariants({ lookup, constructors })'],
    ['helper-codec-invariants', 'const input: DataTypeInvariantInput = build();'],
  ])('%s detects %s', (id, line) => {
    expect(detects('extension', id, line)).toBe(true);
  });
});

describe('extension detection of the renamed helper codec check', () => {
  it('does not detect the new names', () => {
    expect(
      detects(
        'extension',
        'helper-codec-invariants',
        'enforceHelperCodecInvariants({ lookup, helpers, codecDescriptorFor })',
      ),
    ).toBe(false);
  });
});

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
      'upgrade-instructions/pending/default-function-arguments-and-generator-data-types',
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

describe('app detection', () => {
  it.each([
    [
      'prisma7-default-function-arguments-checked',
      'id String @default(uuid(5))',
      'id String @default(uuid(7))',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'id String @default(uuid(5))',
      'id String @default(uuid())',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'code String @default(cuid(1))',
      'code String @default(cuid(2))',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'code String @default(cuid(1))',
      'code String @default(cuid())',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'a String @default(nanoid(1))',
      'a String @default(nanoid(12))',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'a String @default(nanoid(1000))',
      'a String @default(nanoid(255))',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'a String @default(nanoid(256))',
      'a String @default(nanoid(2))',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'a String @default(nanoid(size: 8))',
      'a String @default(nanoid(8))',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'a String @default(nanoid(8.5))',
      'a String @default(nanoid())',
    ],
    [
      'default-function-argument-diagnostics',
      "expect(message).toBe('Expected one of: 4 | 7');",
      "expect(message).toBe('uuid: version must be 4 or 7, got 5');",
    ],
    [
      'default-function-argument-diagnostics',
      "expect(message).toBe('Expected an integer between 2 and 255');",
      "expect(message).toBe('nanoid: size must be between 2 and 255, got 1');",
    ],
    [
      'default-function-argument-diagnostics',
      `expect(message).toBe('Attribute "cuid" is missing required argument "version"');`,
      `expect(message).toBe('Default function "cuid" is missing required argument "version"');`,
    ],
    [
      'default-function-argument-diagnostics',
      '{"message": "Attribute \\"nanoid\\" received too many positional arguments"}',
      '{"message": "Attribute \\"map\\" received too many positional arguments"}',
    ],
    [
      'generator-applicability-names-data-type',
      `'Default generator "uuidv4" is not applicable to "Row.value" with codecId "pg/int4@1".'`,
      `'Default generator "uuidv4" is not applicable to "Row.value" with data type "pg/int4".'`,
    ],
    [
      'discriminator-must-be-text',
      `'Discriminator field "type" on model "Task" must be of type String, but is "Int"'`,
      `'Discriminator field "type" on model "Task" must be text, such as String, but is "Int"'`,
    ],
  ])('%s finds the old use and skips the new one', (id, before, after) => {
    expect({ before: detects('app', id, before), after: detects('app', id, after) }).toEqual({
      before: true,
      after: false,
    });
  });
});

describe('extension detection', () => {
  it.each([
    [
      'generator-applicable-data-types',
      "generatorDescriptors: [{ id: 'slugid', applicableCodecIds: ['pg/text@1'] }],",
      "generatorDescriptors: [{ id: 'slugid', applicableDataTypes: [dataTypeId('pg/text')] }],",
    ],
    [
      'builtin-generator-metadata-writes-uuid',
      'builtinGeneratorRegistryMetadata.map(({ id, applicableCodecIds }) => ({ id, applicableCodecIds }))',
      'sqlBuiltinGeneratorDescriptors({ text: [pgText.id], uuid: [pgUuid.id] })',
    ],
    [
      'generator-applicability-names-data-type',
      `expect(message).toContain('with codecId "pg/int4@1"');`,
      `expect(message).toContain('with data type "pg/int4"');`,
    ],
    [
      'default-function-signature-from-data-types',
      'for (const [name, entry] of stack.defaultFunctionRegistry) arms.push(funcCall(name, entry.signature as FuncCallSig));',
      'for (const [name, entry] of stack.defaultFunctionRegistry) arms.push(defaultFunctionCall(name, entry, dataTypes));',
    ],
    [
      'arg-binding-spec-label',
      "interpretArgs(args, { name: 'rel', positional, named }, ctx, span, node);",
      'interpretAttribute(node, spec, ctx);',
    ],
    [
      'arg-binding-spec-label',
      'const spec: ArgBindingSpec<AttributeCtx> = { name, positional, named };',
      'const spec: AttributeSpec<Out, AttributeCtx> = fieldAttribute(name, options);',
    ],
    [
      'one-of-refuses-data-type-value',
      'type: oneOf(str(), dataTypeValue(pgInt4.id, dataTypes)),',
      'type: dataTypeValue(pgInt4.id, dataTypes),',
    ],
  ])('%s finds the old use and skips the new one', (id, before, after) => {
    expect({
      before: detects('extension', id, before),
      after: detects('extension', id, after),
    }).toEqual({ before: true, after: false });
  });

  it('skips a signature read in a file that names no default function registry', () => {
    expect(
      detects(
        'extension',
        'default-function-signature-from-data-types',
        'const label = type.signature.documentation;',
      ),
    ).toBe(false);
  });
});

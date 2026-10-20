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
      'upgrade-instructions/pending/generator-function-arguments-and-column-length',
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
      'id String @default(uuid(4.0))',
      'id String @default(uuid(4))',
    ],
    [
      'prisma7-default-function-arguments-checked',
      'a String @default(nanoid(8.5))',
      'a String @default(nanoid())',
    ],
    [
      'generator-function-argument-with-fraction',
      'a String @default(nanoid(8.0))',
      'a String @default(nanoid(8))',
    ],
    [
      'generator-function-argument-with-fraction',
      'id String @default(uuid(7.0))',
      'id String @default(uuid(7))',
    ],
    [
      'generator-function-argument-diagnostics',
      "expect(message).toBe('Expected one of: 4 | 7');",
      "expect(message).toBe('uuid: version must be 4 or 7, got 5');",
    ],
    [
      'generator-function-argument-diagnostics',
      "expect(message).toBe('Expected an integer between 2 and 255');",
      "expect(message).toBe('nanoid: size must be between 2 and 255, got 1');",
    ],
    [
      'generator-function-argument-diagnostics',
      `expect(message).toBe('Attribute "cuid" is missing required argument "version"');`,
      `expect(message).toBe('Generator function "cuid" is missing required argument "version"');`,
    ],
    [
      'generator-function-argument-diagnostics',
      '{"message": "Attribute \\"nanoid\\" received too many positional arguments"}',
      '{"message": "Attribute \\"map\\" received too many positional arguments"}',
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

describe('app detection of the discriminator message', () => {
  it('skips a Mongo project, whose message is unchanged', () => {
    expect(
      detects(
        'app',
        'discriminator-must-be-text',
        `const source = mongoContract(schemaPath);\nexpect(message).toContain('must be of type String');`,
      ),
    ).toBe(false);
  });
});

describe('extension detection', () => {
  it.each([
    [
      'sql-target-declares-integer-argument-generators',
      'generatorFunctions: [...idGeneratorFunctionBindings({ text: [MY_TEXT_CODEC_ID] })],',
      'generatorFunctions: [...sqlIntegerArgumentGeneratorFunctions({ integer: myInt4.id }), ...idGeneratorFunctionBindings({ text: [MY_TEXT_CODEC_ID] })],',
    ],
    [
      'generator-signature-from-data-types',
      'for (const [name, entry] of stack.defaultFunctionRegistry) arms.push(funcCall(name, entry.signature as FuncCallSig));',
      'for (const [name, entry] of stack.defaultFunctionRegistry) arms.push(defaultFunctionCall(name, entry, dataTypes));',
    ],
    [
      'generator-signature-from-data-types',
      'for (const fn of pack.generatorFunctions) arms.push(funcCall(fn.name, fn.signature as FuncCallSig));',
      'for (const { name, signature } of pack.generatorFunctions) arms.push(generatorFunctionCall(name, signature, dataTypes));',
    ],
    [
      'generator-function-field-length',
      'const resolution = generatorFunctions.resolve(call, { codecId, typeParams });',
      'const resolution = registry.lookup(call.name);',
    ],
    [
      'build-contract-definition-takes-lookups',
      'const definition = buildContractDefinition({ family, target, createNamespace, models });',
      'return buildSqlContractFromDefinition(definition, codecLookup, dataTypeLookup);',
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
        'generator-signature-from-data-types',
        'const label = type.signature.documentation;',
      ),
    ).toBe(false);
  });
});

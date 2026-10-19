import {
  type AuthoringFieldNamespace,
  isAuthoringFieldPresetDescriptor,
} from '@internal/framework-components/authoring';
import { timeouts } from '@repo/test-utils';
import { describe, expect, it } from 'vitest';
import { extensions as slugidExtensions } from '../authoring/parity/default-pack-slugid/packs';
import {
  composePostgresStack,
  type PostgresStack,
  printAndReadBack,
  readPsl,
  serializedWithoutCapabilities,
} from './print-and-read-back';

const stack = composePostgresStack();

/**
 * Every call the stack registers a PSL default function for, with a written range such as
 * `<2-255>` replaced by its lower bound.
 */
const defaultFunctionCalls = [...stack.controlMutationDefaults.defaultFunctionRegistry.values()]
  .flatMap((entry) => entry.usageSignatures ?? [])
  .map((usage) => usage.replace(/<(\d+)-\d+>/, '$1'));

/** A call of every generator function the stack binds to `String`, with each argument form. */
const textGeneratorCalls = [
  'uuid()',
  'uuid(7)',
  'cuid(2)',
  'ulid()',
  'nanoid()',
  'nanoid(2)',
  'ksuid()',
];

/** Every `temporal.*` field preset the stack contributes, called with the now generator in each phase it takes. */
function temporalPresetCalls(namespace: AuthoringFieldNamespace): readonly string[] {
  const temporal = namespace['temporal'];
  if (temporal === undefined || isAuthoringFieldPresetDescriptor(temporal)) return [];
  return Object.entries(temporal).flatMap(([name, preset]) => {
    if (!isAuthoringFieldPresetDescriptor(preset)) return [];
    const phases = (preset.args ?? [])
      .map((arg) => arg.name)
      .filter((argName) => argName === 'onCreate' || argName === 'onUpdate')
      .map((argName) => `${argName}: now`);
    return [`temporal.${name}(${phases.join(', ')})`];
  });
}

async function roundTrip(field: string, withStack: PostgresStack = stack): Promise<void> {
  const authored = await readPsl(
    `// use prisma-8
model Widget {
  id    Int @id
  ${field}
}
`,
    { stack: withStack },
  );
  const printed = await printAndReadBack(authored, { stack: withStack });

  expect(serializedWithoutCapabilities(printed)).toEqual(serializedWithoutCapabilities(authored));
}

describe('every generated value the stack reads prints as PSL that reads back', () => {
  it('finds the default functions, generator functions and temporal presets', () => {
    expect(defaultFunctionCalls).toContain('now()');
    expect(stack.generatorFunctions.functionsFor('pg/text@1').map(({ name }) => name)).toEqual(
      [...new Set(textGeneratorCalls.map((call) => call.slice(0, call.indexOf('('))))].sort(),
    );
    expect(temporalPresetCalls(stack.authoringContributions.field)).toContain(
      'temporal.timestamptz(onCreate: now, onUpdate: now)',
    );
  });

  it.each(defaultFunctionCalls)(
    '@default(%s)',
    async (call) => {
      const type = call.startsWith('autoincrement')
        ? 'Int'
        : call.startsWith('now')
          ? 'DateTime'
          : 'String';
      await roundTrip(`value ${type} @default(${call})`);
    },
    timeouts.pslRoundTrip,
  );

  it.each(textGeneratorCalls)(
    '@onCreate(%s)',
    async (call) => {
      await roundTrip(`value String @onCreate(${call})`);
    },
    timeouts.pslRoundTrip,
  );

  it(
    '@onCreate(now()) @onUpdate(now()) beside @default(now())',
    async () => {
      await roundTrip('value DateTime @default(now()) @onCreate(now()) @onUpdate(now())');
    },
    timeouts.pslRoundTrip,
  );

  it.each(temporalPresetCalls(stack.authoringContributions.field))(
    '%s',
    async (call) => {
      await roundTrip(`value ${call}`);
    },
    timeouts.pslRoundTrip,
  );

  it(
    'a default function an extension registers',
    async () => {
      await roundTrip(
        'value String @onCreate(slugid())',
        composePostgresStack([...slugidExtensions]),
      );
    },
    timeouts.pslRoundTrip,
  );
});

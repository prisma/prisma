import { type } from 'arktype';

export const MAX_TELEMETRY_STRING_LENGTH = 512;
export const MAX_TELEMETRY_ARRAY_ITEM_LENGTH = 128;

const requiredString = type.string.moreThanLength(0).atMostLength(MAX_TELEMETRY_STRING_LENGTH);
const optionalString = type.string.atMostLength(MAX_TELEMETRY_STRING_LENGTH).or('null');
const stringArray = type.string.atMostLength(MAX_TELEMETRY_ARRAY_ITEM_LENGTH).array();

// Command-specific facts beyond the shared columns, one level deep so plain
// jsonb operators can query them.
const propertyValue = optionalString.or(type.number).or(type.boolean).or(stringArray);
const properties = type
  .Record('string', propertyValue)
  .narrow((value, ctx) => !Array.isArray(value) || ctx.mustBe('an object'));

export const eventPayloadSchema = type({
  installationId: requiredString,
  version: requiredString,
  command: requiredString,
  runtimeName: requiredString,
  runtimeVersion: requiredString,
  os: requiredString,
  arch: requiredString,
  flags: stringArray.default(() => []),
  packageManager: optionalString.default(null),
  databaseTarget: optionalString.default(null),
  tsVersion: optionalString.default(null),
  agent: optionalString.default(null),
  extensions: stringArray.default(() => []),
  exitCode: type.number.or('null').default(null),
  properties: properties.or('null').default(null),
  '+': 'delete',
});

export type EventPayload = typeof eventPayloadSchema.infer;

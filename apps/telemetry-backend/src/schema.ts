import { type } from 'arktype';

export const MAX_TELEMETRY_STRING_LENGTH = 512;
export const MAX_TELEMETRY_ARRAY_ITEM_LENGTH = 128;
export const MAX_TELEMETRY_PROPERTY_COUNT = 64;

const requiredString = type.string.moreThanLength(0).atMostLength(MAX_TELEMETRY_STRING_LENGTH);
const optionalString = type.string.atMostLength(MAX_TELEMETRY_STRING_LENGTH).or('null');
const stringArray = type.string.atMostLength(MAX_TELEMETRY_ARRAY_ITEM_LENGTH).array();

// Command-specific facts a client reports beyond the shared columns (a
// scaffold's template, a failure's stage). Flat on purpose: one level of
// scalars and string lists stays queryable with plain jsonb operators.
const propertyValue = optionalString.or(type.number).or(type.boolean).or(stringArray);
const properties = type.Record('string', propertyValue).narrow((value, ctx) => {
  if (Array.isArray(value)) return ctx.mustBe('an object');
  const keys = Object.keys(value);
  if (keys.length > MAX_TELEMETRY_PROPERTY_COUNT) {
    return ctx.mustBe(`at most ${MAX_TELEMETRY_PROPERTY_COUNT} properties`);
  }
  return keys.every((key) => key.length > 0 && key.length <= MAX_TELEMETRY_ARRAY_ITEM_LENGTH)
    ? true
    : ctx.mustBe(`keyed by names of 1 to ${MAX_TELEMETRY_ARRAY_ITEM_LENGTH} characters`);
});

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

import { type } from 'arktype';

export const MAX_TELEMETRY_STRING_LENGTH = 512;
export const MAX_TELEMETRY_ARRAY_ITEM_LENGTH = 128;

const requiredString = type.string.moreThanLength(0).atMostLength(MAX_TELEMETRY_STRING_LENGTH);
const optionalString = type.string.atMostLength(MAX_TELEMETRY_STRING_LENGTH).or('null');
const stringArray = type.string.atMostLength(MAX_TELEMETRY_ARRAY_ITEM_LENGTH).array();

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
  '+': 'delete',
});

export type EventPayload = typeof eventPayloadSchema.infer;

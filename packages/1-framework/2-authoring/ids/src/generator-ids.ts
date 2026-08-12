export const builtinGeneratorIds = [
  'ulid',
  'nanoid',
  'uuidv7',
  'uuidv4',
  'cuid2',
  'ksuid',
] as const;

export type BuiltinGeneratorId = (typeof builtinGeneratorIds)[number];

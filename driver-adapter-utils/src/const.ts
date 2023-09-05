// Same order as in rust driver-adapters' `ColumnType`.
// Note: exporting const enums causes lots of problems with bundlers, so we emulate
// them via regular dictionaries.
// See: https://hackmd.io/@dzearing/Sk3xV0cLs
export const ColumnTypeEnum = {
  'Int32': 0,
  'Int64': 1,
  'Float': 2,
  'Double': 3,
  'Numeric': 4,
  'Boolean': 5,
  'Char': 6,
  'Text': 7,
  'Date': 8,
  'Time': 9,
  'DateTime': 10,
  'Json': 11,
  'Enum': 12,
  'Bytes': 13,
  // 'Set': 14,
  // 'Array': 15,
  // ...
} as const

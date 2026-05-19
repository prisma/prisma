// Same order as in rust driver-adapters' `ColumnType`.
// Note: exporting const enums causes lots of problems with bundlers, so we emulate
// them via regular dictionaries.
// See: https://hackmd.io/@dzearing/Sk3xV0cLs
export const ColumnTypeEnum = {
  // Scalars
  Int32: 0,
  Int64: 1,
  Float: 2,
  Double: 3,
  Numeric: 4,
  Boolean: 5,
  Character: 6,
  Text: 7,
  Date: 8,
  Time: 9,
  DateTime: 10,
  Json: 11,
  Enum: 12,
  Bytes: 13,
  Set: 14,
  Uuid: 15,
  Point: 16,
  LineString: 17,
  Polygon: 18,
  Geometry: 19,

  // Arrays
  Int32Array: 64,
  Int64Array: 65,
  FloatArray: 66,
  DoubleArray: 67,
  NumericArray: 68,
  BooleanArray: 69,
  CharacterArray: 70,
  TextArray: 71,
  DateArray: 72,
  TimeArray: 73,
  DateTimeArray: 74,
  JsonArray: 75,
  EnumArray: 76,
  BytesArray: 77,
  UuidArray: 78,
  PointArray: 79,
  LineStringArray: 80,
  PolygonArray: 81,
  GeometryArray: 82,

  // Custom
  UnknownNumber: 128,
} as const

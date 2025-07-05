import {
  ArgType,
  ColumnType,
  ColumnTypeEnum,
  Debug,
} from "@prisma/driver-adapter-utils";

const debug = Debug("prisma:driver-adapter:bun-sqlite:conversion");

type Value = null | string | number | bigint | Uint8Array; // Changed ArrayBuffer to Uint8Array as bun:sqlite returns Blobs as Uint8Array
export type Row = {
  /** Number of columns in this row.
   *
   * All rows in one {@link ResultSet} have the same number and names of columns.
   */
  length: number;
  /** Columns can be accessed like an array by numeric indexes. */
  [index: number]: Value;
};

// Mirrors sqlite/conversion.rs in quaint
function mapDeclType(declType: string | null): ColumnType | null {
  if (declType === null) {
    return null;
  }

  switch (declType.toUpperCase()) {
    case "":
      return null;
    case "DECIMAL":
      return ColumnTypeEnum.Numeric;
    case "FLOAT":
      return ColumnTypeEnum.Float;
    case "DOUBLE":
    case "DOUBLE PRECISION":
    case "NUMERIC":
    case "REAL":
      return ColumnTypeEnum.Double;
    case "TINYINT":
    case "SMALLINT":
    case "MEDIUMINT":
    case "INT":
    case "INTEGER":
    case "SERIAL":
    case "INT2":
      return ColumnTypeEnum.Int32;
    case "BIGINT":
    case "UNSIGNED BIG INT":
    case "INT8":
      return ColumnTypeEnum.Int64;
    case "DATETIME":
    case "TIMESTAMP":
      return ColumnTypeEnum.DateTime;
    case "TIME":
      return ColumnTypeEnum.Time;
    case "DATE":
      return ColumnTypeEnum.Date;
    case "TEXT":
    case "CLOB":
    case "CHARACTER":
    case "VARCHAR":
    case "VARYING CHARACTER":
    case "NCHAR":
    case "NATIVE CHARACTER":
    case "NVARCHAR":
      return ColumnTypeEnum.Text;
    case "BLOB":
      return ColumnTypeEnum.Bytes;
    case "BOOLEAN":
      return ColumnTypeEnum.Boolean;
    case "JSONB":
      return ColumnTypeEnum.Json;
    default:
      debug("unknown decltype:", declType);
      return null;
  }
}

function mapDeclaredColumnTypes(
  columnTypes: Array<string | null>,
): [out: Array<ColumnType | null>, empty: Set<number>] {
  const emptyIndices = new Set<number>();
  const result = columnTypes.map((typeName, index) => {
    const mappedType = mapDeclType(typeName);
    if (mappedType === null) {
      emptyIndices.add(index);
    }
    return mappedType;
  });
  return [result, emptyIndices];
}

export function getColumnTypes(
  declaredTypes: Array<string | null>,
  rows: Row[],
): ColumnType[] {
  const [columnTypes, emptyIndices] = mapDeclaredColumnTypes(declaredTypes);

  if (emptyIndices.size === 0) {
    return columnTypes as ColumnType[];
  }

  columnLoop: for (const columnIndex of emptyIndices) {
    // No declared column type in db schema, infer using first non-null value
    for (let rowIndex = 0; rowIndex < rows.length; rowIndex++) {
      const candidateValue = rows[rowIndex][columnIndex];
      // Ensure candidateValue is strictly not null and not undefined before inferring.
      // While the Row type implies it won't be undefined, defensive check is good.
      if (candidateValue !== null && candidateValue !== undefined) {
        columnTypes[columnIndex] = inferColumnType(candidateValue);
        continue columnLoop;
      }
    }

    // No non-null value found for this column, fall back to Int32 to mimic what quaint does
    // This case should cover columns where all values are NULL, or unexpectedly undefined.
    columnTypes[columnIndex] = ColumnTypeEnum.Int32;
  }

  return columnTypes as ColumnType[];
}

function inferColumnType(value: NonNullable<Value>): ColumnType {
  switch (typeof value) {
    case "string":
      return ColumnTypeEnum.Text;
    case "bigint":
      return ColumnTypeEnum.Int64;
    case "boolean":
      return ColumnTypeEnum.Boolean;
    case "number":
      return ColumnTypeEnum.UnknownNumber;
    case "object":
      return inferObjectType(value);
    default:
      throw new UnexpectedTypeError(value);
  }
}

function inferObjectType(value: object): ColumnType {
  // bun:sqlite returns blobs as Uint8Array
  if (value instanceof Uint8Array) {
    return ColumnTypeEnum.Bytes;
  }
  // The original code had a check for ArrayBuffer, but bun:sqlite consistently returns Uint8Array for BLOBs.
  // If ArrayBuffer is expected from other contexts, this check might still be useful,
  // but for direct bun:sqlite results, Uint8Array is the primary type.
  throw new UnexpectedTypeError(value);
}

class UnexpectedTypeError extends Error {
  name = "UnexpectedTypeError";
  constructor(value: unknown) {
    const type = typeof value;
    const repr = type === "object" ? JSON.stringify(value) : String(value);
    super(`unexpected value of type ${type}: ${repr}`);
  }
}

export function mapRow(row: Row, columnTypes: ColumnType[]): unknown[] {
  // `Row` doesn't have map, so we copy the array once and modify it in-place
  // to avoid allocating and copying twice if we used `Array.from(row).map(...)`.
  const result: unknown[] = Array.from(row);

  for (let i = 0; i < result.length; i++) {
    const value = result[i];

    // Convert Uint8Array to arrays of bytes.
    // bun:sqlite returns blobs as Uint8Array.
    if (value instanceof Uint8Array) {
      result[i] = Array.from(value);
      continue;
    }

    // If an integer is required and the current number isn't one,
    // discard the fractional part.
    if (
      typeof value === "number" &&
      (columnTypes[i] === ColumnTypeEnum.Int32 ||
        columnTypes[i] === ColumnTypeEnum.Int64) &&
      !Number.isInteger(value)
    ) {
      result[i] = Math.trunc(value);
      continue;
    }

    // Decode DateTime values saved as numeric timestamps which is the
    // format used by the native quaint sqlite connector.
    if (
      ["number", "bigint"].includes(typeof value) &&
      columnTypes[i] === ColumnTypeEnum.DateTime
    ) {
      result[i] = new Date(Number(value)).toISOString();
      continue;
    }

    // Convert bigint to string as we can only use JSON-encodable types here.
    if (typeof value === "bigint") {
      result[i] = value.toString();
      continue;
    }
  }

  return result;
}

export function mapQueryArgs(args: unknown[], argTypes: ArgType[]): unknown[] {
  return args.map((arg, i) => {
    const argType = argTypes[i];
    if (argType === "Int32") {
      return Number.parseInt(arg as string);
    }

    if (argType === "Float" || argType === "Double") {
      return Number.parseFloat(arg as string);
    }

    if (typeof arg === "boolean") {
      return arg ? 1 : 0; // SQLite does not natively support booleans
    }

    if (arg instanceof Date) {
      return arg
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "");
    }

    // bun:sqlite expects blobs as Uint8Array
    if (arg instanceof Uint8Array) {
      return arg;
    }

    // Convert ArrayBuffer to Uint8Array for blobs, as bun:sqlite works with Uint8Array
    if (arg instanceof ArrayBuffer) {
      return new Uint8Array(arg);
    }

    return arg;
  });
}

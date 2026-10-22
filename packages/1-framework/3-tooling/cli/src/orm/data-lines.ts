type DataField = string | number | boolean | null | undefined;

/**
 * One data line: the fields tab-separated, an absent field left empty so a
 * script reads the columns by position.
 */
export function dataLine(fields: readonly DataField[]): string {
  return fields
    .map((field) => (field === null || field === undefined ? '' : String(field)))
    .join('\t');
}

/** `key<TAB>value` lines for a show; a field whose value is absent is left out. */
export function showLines(rows: readonly (readonly [string, DataField])[]): readonly string[] {
  return rows
    .filter(([, value]) => value !== null && value !== undefined)
    .map(([key, value]) => dataLine([key, value]));
}

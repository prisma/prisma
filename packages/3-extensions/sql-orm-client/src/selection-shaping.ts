export function augmentSelectionForJoinColumns(
  selectedFields: readonly string[] | undefined,
  requiredColumns: readonly string[],
): {
  selectedForQuery: readonly string[] | undefined;
  hiddenColumns: readonly string[];
} {
  if (!selectedFields) {
    return {
      selectedForQuery: selectedFields,
      hiddenColumns: [],
    };
  }

  const hiddenColumns = requiredColumns.filter((column) => !selectedFields.includes(column));
  if (hiddenColumns.length === 0) {
    return {
      selectedForQuery: selectedFields,
      hiddenColumns: [],
    };
  }

  return {
    selectedForQuery: [...selectedFields, ...hiddenColumns],
    hiddenColumns,
  };
}

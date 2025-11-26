export function getMigrationNameSuggestion(diff: string): string | undefined {
  const lines = diff.split('\n').map((l) => l.trim())
  
  // We are looking for lines that start with specific patterns in the human readable diff
  // Example lines from migrate diff output (human readable):
  // [+] Added the `new_col` column to the `Test` table without a default value. This is not possible if the table is not empty.
  // [-] Removed the `old_col` column from the `Test` table.
  // [+] Added the `NewTable` table.

  const addedColumns: { table: string; column: string }[] = []
  const removedColumns: { table: string; column: string }[] = []
  const addedTables: string[] = []

  for (const line of lines) {
    // Added column
    const addedColMatch = line.match(/^\[\+\] Added the `(.*?)` column to the `(.*?)` table/)
    if (addedColMatch) {
      addedColumns.push({ column: addedColMatch[1], table: addedColMatch[2] })
      continue
    }

    // Removed column
    const removedColMatch = line.match(/^\[-\] Removed the `(.*?)` column from the `(.*?)` table/)
    if (removedColMatch) {
      removedColumns.push({ column: removedColMatch[1], table: removedColMatch[2] })
      continue
    }

    // Added table
    const addedTableMatch = line.match(/^\[\+\] Added the `(.*?)` table/)
    if (addedTableMatch) {
      addedTables.push(addedTableMatch[1])
      continue
    }
  }

  // Logic to determine the suggestion
  
  // 1. Single added column
  if (addedColumns.length === 1 && removedColumns.length === 0 && addedTables.length === 0) {
    return `add_${addedColumns[0].column}_to_${addedColumns[0].table}`
  }

  // 2. Multiple added columns in the same table
  if (addedColumns.length > 1 && removedColumns.length === 0 && addedTables.length === 0) {
    const tables = new Set(addedColumns.map((c) => c.table))
    if (tables.size === 1) {
      return `add_fields_to_${addedColumns[0].table}`
    }
  }

  // 3. Single removed column
  if (removedColumns.length === 1 && addedColumns.length === 0 && addedTables.length === 0) {
    return `drop_${removedColumns[0].column}_in_${removedColumns[0].table}`
  }

  // 4. Single added table
  if (addedTables.length === 1 && addedColumns.length === 0 && removedColumns.length === 0) {
    return `create_table_${addedTables[0]}`
  }

  return undefined
}

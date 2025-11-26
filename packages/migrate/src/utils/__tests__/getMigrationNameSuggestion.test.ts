import { getMigrationNameSuggestion } from '../getMigrationNameSuggestion'

describe('getMigrationNameSuggestion', () => {
  test('should suggest name for single added column', () => {
    const diff = `
[+] Added the ` + '`new_col`' + ` column to the ` + '`Test`' + ` table without a default value.
`
    expect(getMigrationNameSuggestion(diff)).toBe('add_new_col_to_Test')
  })

  test('should suggest name for multiple added columns in same table', () => {
    const diff = `
[+] Added the ` + '`col1`' + ` column to the ` + '`Test`' + ` table.
[+] Added the ` + '`col2`' + ` column to the ` + '`Test`' + ` table.
`
    expect(getMigrationNameSuggestion(diff)).toBe('add_fields_to_Test')
  })

  test('should not suggest name for multiple added columns in different tables', () => {
    const diff = `
[+] Added the ` + '`col1`' + ` column to the ` + '`Test1`' + ` table.
[+] Added the ` + '`col2`' + ` column to the ` + '`Test2`' + ` table.
`
    expect(getMigrationNameSuggestion(diff)).toBeUndefined()
  })

  test('should suggest name for single removed column', () => {
    const diff = `
[-] Removed the ` + '`old_col`' + ` column from the ` + '`Test`' + ` table.
`
    expect(getMigrationNameSuggestion(diff)).toBe('drop_old_col_in_Test')
  })

  test('should suggest name for single added table', () => {
    const diff = `
[+] Added the ` + '`NewTable`' + ` table.
`
    expect(getMigrationNameSuggestion(diff)).toBe('create_table_NewTable')
  })

  test('should return undefined for complex changes', () => {
    const diff = `
[+] Added the ` + '`new_col`' + ` column to the ` + '`Test`' + ` table.
[-] Removed the ` + '`old_col`' + ` column from the ` + '`Test`' + ` table.
`
    expect(getMigrationNameSuggestion(diff)).toBeUndefined()
  })

  test('should return undefined for no changes', () => {
    const diff = ``
    expect(getMigrationNameSuggestion(diff)).toBeUndefined()
  })
})

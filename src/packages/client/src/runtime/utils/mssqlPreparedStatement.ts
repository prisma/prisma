// Generate something like: SELECT * FROM User WHERE name = @P1 AND email = @P2 ...
export const mssqlPreparedStatement = (
  template:  ReadonlyArray<string> | TemplateStringsArray,
) => {
  return template.reduce((acc, str, idx) => `${acc}@P${idx}${str}`)
}

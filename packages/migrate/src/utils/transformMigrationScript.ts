
export function transformPostgresMnPrimaryKeyUpgrade(script: string): string {
  const pattern =
    /ALTER TABLE "([^"]+)" ADD CONSTRAINT "([^"]+)_pkey" PRIMARY KEY \([^)]+\);\s*\n(?:\s*--[^\n]*\n)?\s*DROP INDEX (?:IF EXISTS )?((?:"[^"]+"\.)?"[^"]+_unique");/g

  return script.replace(pattern, (_, table, constraintBase, indexIdentifier) => {
    return `ALTER TABLE "${table}" ADD CONSTRAINT "${constraintBase}_pkey" PRIMARY KEY USING INDEX ${indexIdentifier};`
  })
}

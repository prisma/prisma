import { ErrorCapturingSqlDriverAdapterFactory } from '@prisma/driver-adapter-utils'
import { SchemaContext } from '@prisma/internals'

const DEPRECATED_PROPERTIES = ['url', 'directUrl', 'shadowDatabaseUrl']
// Due to the complexity of making the datasource.url truly optional across the codebase
// this placeholder value is used in the PSL parser if no URL property is given.
const NO_URL_PLACEHOLDER = '<invalid>'

export function warnDatasourceDriverAdapter(
  schemaContext: SchemaContext | undefined,
  adapter: ErrorCapturingSqlDriverAdapterFactory | undefined,
) {
  if (!schemaContext || !adapter) return

  const foundProperties: string[] = []
  for (const property of DEPRECATED_PROPERTIES) {
    if (
      schemaContext.primaryDatasource?.[property] &&
      schemaContext.primaryDatasource?.[property].value !== NO_URL_PLACEHOLDER
    ) {
      foundProperties.push(property)
    }
  }

  if (foundProperties.length > 0) {
    process.stdout.write(
      `
WARNING: Your schema specifies the following datasource properties but you are using a Driver Adapter via prisma.config.ts:
${foundProperties.map((property) => `- ${property}`).join('\n')}

The values from your schema will NOT be used!

We recommend you to remove those properties from your schema to avoid confusion if you are only using driver adapters.
`,
    )
  }
}

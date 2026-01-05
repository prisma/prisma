# @refract/field-translator

Build-time database-specific field transformation code generators for Refract.

This package is used by the client generator and migration tooling to map Prisma schema field types to
Dialect-specific database types and to emit transformation code strings. It is not intended for direct
runtime use.

## Usage

Most users should not import this package directly. It is consumed by:

- `@refract/client` (client generation)
- `@refract/migrate` (schema diffing and DDL mapping)

If you do need it for custom tooling, use the dialect helpers:

```ts
import { createFieldTranslator, detectDialect } from '@refract/field-translator'

const dialect = detectDialect({ database: { provider: 'postgresql' } })
const translator = createFieldTranslator(dialect)
```

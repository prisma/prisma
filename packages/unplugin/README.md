# unplugin-ork

Provides virtual modules for clean `.ork` imports. This is the recommended way to use Ork.

## Features

- Clean `.ork` imports via virtual modules.
- Instant type updates and HMR during development.
- Works with Vite, Webpack, Rollup, and esbuild
- Works out of the box with sensible defaults

## Installation

```bash
npm install unplugin-ork
```

## Usage

### Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import ork from 'unplugin-ork/vite'

export default defineConfig({
  plugins: [
    ork({
      schema: './schema.prisma', // optional, defaults to './schema.prisma'
      debug: true, // optional, enables logging
    }),
  ],
})
```

### Webpack

```js
// webpack.config.js
const OrkPlugin = require('unplugin-ork/webpack')

module.exports = {
  plugins: [
    OrkPlugin({
      schema: './schema.prisma',
    }),
  ],
}
```

### Rollup

```ts
// rollup.config.ts
import ork from 'unplugin-ork/rollup'

export default {
  plugins: [
    ork({
      schema: './schema.prisma',
    }),
  ],
}
```

### esbuild

```ts
// build.ts
import { build } from 'esbuild'
import ork from 'unplugin-ork/esbuild'

build({
  plugins: [
    ork({
      schema: './schema.prisma',
    }),
  ],
})
```

## Client Usage

Once the plugin is configured, you can use clean imports in your application:

```typescript
import { OrkClient } from '@ork/client'
import { PostgresDialect } from 'kysely'

// Types are automatically available via virtual modules
const client = new OrkClient(new PostgresDialect({ connectionString: process.env.DATABASE_URL! }))

// Fully typed CRUD operations
const user = await client.user.findUnique({
  where: { id: 1 },
})
```

## How It Works

1. Monitors your `schema.prisma` file for changes via watch.
2. Parses your schema and generates TypeScript interfaces.
3. Creates virtual `.ork/types` module during build.
4. Automatically augments OrkClient with your types.
5. Provides instant updates during development via HMR.

## Options

```typescript
interface OrkPluginOptions {
  /** Path to schema.prisma file (default: './schema.prisma') */
  schema?: string

  /** Directory for generated types (default: './.ork') */
  outputDir?: string

  /** Watch for schema changes (default: true in dev) */
  watch?: boolean

  /** Enable debug logging (default: false) */
  debug?: boolean

  /** Disable all output (default: false) */
  silent?: boolean

  /** Preserve terminal output instead of clearing on regeneration */
  preserveLogs?: boolean

  /** Automatically write the generated client to disk (default: true) */
  autoGenerateClient?: boolean

  /** Automatically apply migrations on schema change (default: false) */
  autoMigrate?: boolean

  /** Migration safety mode (default: 'safe') */
  autoMigrateMode?: 'safe' | 'force'

  /** Optional hook fired after schema changes are processed */
  onSchemaChange?: (info: {
    reason: string
    schemaPath: string
    generatedClient: boolean
    migrated: boolean
    migrationSkippedReason?: string
    errors?: string[]
  }) => void

  /** Project root directory (default: process.cwd()) */
  root?: string
}
```

## Migrate an Ork project to use `unplugin-ork`

**Step 1**: Install the plugin

```bash
npm install unplugin-ork
```

**Step 2**: Add to your bundler config (see examples above)

**Step 3**: Remove manual generation scripts

- Remove custom file watchers
- Remove manual `ork generate` calls from build scripts
- Clean up any custom TypeScript compilation steps

### Why the Plugin is Recommended

| Feature           | Manual Workflow          | Plugin                   |
| ----------------- | ------------------------ | ------------------------ |
| Setup complexity  | High - many manual steps | Low - single config line |
| Type updates      | Manual regeneration      | Automatic with HMR       |
| Error handling    | Basic CLI output         | Rich contextual errors   |
| Build integration | Custom setup required    | Built-in optimization    |
| Performance       | No caching               | Production caching       |
| Import style      | Verbose paths            | Clean `.ork/types`       |
| Development UX    | Basic                    | Next.js-like experience  |

## License

Apache-2.0

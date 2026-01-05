# unplugin-refract

> The **PRIMARY blessed path** for Refract development

Provides virtual modules for clean `.refract/types` imports that work like Next.js and React Router 7 patterns. This is the **recommended way** to use Refract.

## Features

✨ **Virtual Modules**: Clean `.refract/types` imports without physical files  
🔥 **Hot Module Replacement**: Instant type updates during development  
🏗️ **Universal Support**: Works with Vite, Webpack, Rollup, and esbuild  
⚡ **Zero Config**: Works out of the box with sensible defaults  
🎯 **TypeScript Native**: Perfect type inference and IntelliSense

## Installation

```bash
npm install unplugin-refract
```

## Usage

### Vite

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import refract from 'unplugin-refract/vite'

export default defineConfig({
  plugins: [
    refract({
      schema: './schema.prisma', // optional, defaults to './schema.prisma'
      debug: true, // optional, enables logging
    }),
  ],
})
```

### Webpack

```js
// webpack.config.js
const RefractPlugin = require('unplugin-refract/webpack')

module.exports = {
  plugins: [
    RefractPlugin({
      schema: './schema.prisma',
    }),
  ],
}
```

### Rollup

```ts
// rollup.config.ts
import refract from 'unplugin-refract/rollup'

export default {
  plugins: [
    refract({
      schema: './schema.prisma',
    }),
  ],
}
```

### esbuild

```ts
// build.ts
import { build } from 'esbuild'
import refract from 'unplugin-refract/esbuild'

build({
  plugins: [
    refract({
      schema: './schema.prisma',
    }),
  ],
})
```

## Client Usage

Once the plugin is configured, you can use clean imports in your application:

```typescript
// The blessed path - just works!
import { RefractClient } from '@refract/client'
import { PostgresDialect } from 'kysely'

// Types are automatically available via virtual modules
const client = new RefractClient(new PostgresDialect({ connectionString: process.env.DATABASE_URL }))

// Fully typed CRUD operations
const user = await client.user.findUnique({
  where: { id: 1 },
})
```

## How It Works

1. **Schema Watching**: Monitors your `schema.prisma` file for changes
2. **Type Generation**: Parses schema and generates TypeScript interfaces
3. **Virtual Modules**: Creates virtual `.refract/types` module during build
4. **Module Augmentation**: Automatically augments RefractClient with your types
5. **HMR Integration**: Provides instant updates during development

## Options

```typescript
interface RefractPluginOptions {
  /** Path to schema.prisma file (default: './schema.prisma') */
  schema?: string

  /** Directory for generated types (default: './.refract') */
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

## Manual Fallback Workflow

> **Note**: The plugin above is the **recommended blessed path**. Manual workflows are supported but not the primary experience.

If you prefer not to use the plugin, you can still use Refract manually:

### 1. Generate Types Manually

```bash
# Standard Refract CLI commands work independently
npx refract generate
npx refract migrate dev
```

### 2. Import from Generated Files

```typescript
// Manual imports from generated files (not recommended)
import type { DatabaseSchema } from './.refract/types'
import { RefractClient } from '@refract/client'

const client = new RefractClient<DatabaseSchema>(dialect)
```

### 3. Manual Type Management

You'll need to:

- Manually regenerate types after schema changes
- Manage file watching yourself
- Handle TypeScript compilation manually
- Set up your own build integration

### Migration from Manual to Plugin

**Step 1**: Install the plugin

```bash
npm install unplugin-refract
```

**Step 2**: Add to your bundler config (see examples above)

**Step 3**: Update imports

```typescript
// Before (manual)
import type { User } from './prisma/generated/types'

// After (blessed path)
import type { User } from '.refract/types'
```

**Step 4**: Remove manual generation scripts

- Remove custom file watchers
- Remove manual `refract generate` calls from build scripts
- Clean up any custom TypeScript compilation steps

### Why the Plugin is Recommended

| Feature           | Manual Workflow          | Plugin (Blessed Path)    |
| ----------------- | ------------------------ | ------------------------ |
| Setup complexity  | High - many manual steps | Low - single config line |
| Type updates      | Manual regeneration      | Automatic with HMR       |
| Error handling    | Basic CLI output         | Rich contextual errors   |
| Build integration | Custom setup required    | Built-in optimization    |
| Performance       | No caching               | Production caching       |
| Import style      | Verbose paths            | Clean `.refract/types`   |
| Development UX    | Basic                    | Next.js-like experience  |

## License

Apache-2.0

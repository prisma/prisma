# @repo/tsconfig

This package is inspired by https://www.elsakaan.dev/blog/monorepo-college-2.

We're solving unnecessary complexity of `extends` paths in nested `tsconfig.json` files by using `pnpm`'s superpowers.

## Usage

### Installation

Add `@repo/tsconfig` as a workspace devDependency in your package's `package.json`:

```bash
pnpm add -D --workspace @repo/tsconfig
```

Or add it manually to `package.json`:

```json
{
  "devDependencies": {
    "@repo/tsconfig": "workspace:*"
  }
}
```

### Extending the Base Configuration

In your `tsconfig.json`, extend the base configuration:

```json
{
  "extends": ["@repo/tsconfig/base"],
  "compilerOptions": {
    // Your package-specific overrides
  }
}
```

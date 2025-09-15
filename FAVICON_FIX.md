# Fix: Favicon not displaying correctly on prisma.io

Fixes GitHub issue #28090

## Problem
The favicon on https://prisma.io shows the default Next.js favicon instead of the Prisma logo.

## Solution
Added proper favicon implementation:

1. **Added favicon.ico file** - Downloaded official Prisma favicon from their website
2. **Updated HTML head configuration** - Added favicon link tag in layout files

## Changes
- Added `public/favicon.ico` (25KB, official Prisma favicon)
- Updated 2 Next.js layout files with favicon link tags (1 line each)

```tsx
<link rel="icon" type="image/x-icon" href="/favicon.ico" />
```

## Files Changed
- `public/favicon.ico` - Official Prisma favicon
- `packages/client/tests/e2e/nextjs-schema-not-found/18_monorepo-serverComponents-customOutput-reExportIndirect-ts/packages/service/app/layout.tsx`
- `packages/client/tests/e2e/nextjs-schema-not-found/20_monorepo-serverComponents-newGenerator-reExportIndirect-ts/packages/service/app/layout.tsx`

Total: 4 lines of code changed (1 favicon link tag in each layout file)
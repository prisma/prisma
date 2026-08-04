# Brief — deduplicate repeated type imports in generated contract files

Generated contract files can import the same module multiple times — one `import type` line
per imported symbol — instead of aggregating the symbols from a module onto a single import
statement. This was noticed in the output of `prisma-next contract emit`, for example:

```ts
import type { CodecTypes as MongoCodecTypes } from '@internal/adapter-mongo/codec-types';
import type { Vector } from '@internal/adapter-mongo/codec-types';
```

These repeated imports should be deduped, so each module is imported once:

```ts
import type { CodecTypes as MongoCodecTypes, Vector } from '@internal/adapter-mongo/codec-types';
```

Requirements:

- Generated output imports each module on a single statement, preserving any per-symbol
  aliases (e.g. `CodecTypes as MongoCodecTypes`) and the `import type` modifier.
- The generated artifacts remain otherwise unchanged (no semantic difference in what's
  imported) and the fixtures are regenerated to match.

Treat this as one coherent slice (spec + plan + one build loop) ending in a single PR.

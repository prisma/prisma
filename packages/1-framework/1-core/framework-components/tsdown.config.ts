import { defineConfig } from '@repo/tsdown';

export default defineConfig({
  entry: [
    'src/exports/codec.ts',
    'src/exports/components.ts',
    'src/exports/authoring.ts',
    'src/exports/control.ts',
    'src/exports/emission.ts',
    'src/exports/execution.ts',
    'src/exports/ir.ts',
    'src/exports/psl-ast.ts',
    'src/exports/runtime.ts',
    'src/exports/utils.ts',
  ],
});

export type ScaffoldRuntime = 'node' | 'bun' | 'deno';

export function detectScaffoldRuntime(): ScaffoldRuntime {
  if (typeof (globalThis as { Bun?: unknown }).Bun !== 'undefined') return 'bun';
  if (typeof (globalThis as { Deno?: unknown }).Deno !== 'undefined') return 'deno';
  return 'node';
}

export function shebangLineFor(runtime: ScaffoldRuntime): string {
  switch (runtime) {
    case 'bun':
      return '#!/usr/bin/env -S bun';
    case 'deno':
      return '#!/usr/bin/env -S deno run -A';
    case 'node':
      return '#!/usr/bin/env -S node';
  }
}

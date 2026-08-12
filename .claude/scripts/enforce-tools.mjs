#!/usr/bin/env node

import { text } from 'node:stream/consumers';

const input = JSON.parse(await text(process.stdin));
const command = input.tool_input?.command ?? '';

const rules = [
  { pattern: /\bnpm(\s|$)/, reason: 'Use pnpm, not npm' },
  { pattern: /\bnpx(\s|$)/, reason: 'Use pnpm, not npx' },
  {
    pattern: /\bpnpm (exec )?tsc(\s|$)/,
    reason: "Use 'pnpm typecheck' instead of running tsc directly",
  },
  {
    pattern: /\bpnpm (exec )?biome(\s|$)/,
    reason: "Use 'pnpm lint' instead of running biome directly",
  },
  {
    pattern: /\bpnpm (exec )?vitest(\s|$)/,
    reason: "Use 'pnpm test' instead of running vitest directly",
  },
];

for (const { pattern, reason } of rules) {
  if (pattern.test(command)) {
    console.log(JSON.stringify({ decision: 'block', reason }));
    process.exit(0);
  }
}

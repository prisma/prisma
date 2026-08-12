/**
 * Declarative contribution to the `import` block of a rendered TypeScript
 * source file. Each node in an IR declares which symbols it needs from which
 * modules; the top-level renderer deduplicates across nodes and emits one
 * `import { a, b, c } from "…"` line per module.
 *
 * `kind` defaults to `"named"` (e.g. `import { a } from "m"`). Setting it to
 * `"default"` emits `import a from "m"`. `attributes`, if provided, emits an
 * import attributes clause (`with { type: "json" }`) verbatim — required for
 * JSON module imports in the rendered scaffolds.
 *
 * `alias`, when present and different from `symbol`, renders `symbol as alias`.
 * `typeOnly` marks the symbol as a type import: when every symbol contributed
 * for a module is `typeOnly`, the whole statement collapses to
 * `import type { … } from "m"`; when a module mixes value and type symbols, the
 * type-only ones carry a per-specifier `type` prefix (`import { type T, val }`).
 */
export interface ImportRequirement {
  readonly moduleSpecifier: string;
  readonly symbol: string;
  readonly kind?: 'named' | 'default';
  readonly attributes?: Readonly<Record<string, string>>;
  readonly alias?: string;
  readonly typeOnly?: boolean;
}

/**
 * Abstract base class for any IR node that can be emitted as a TypeScript
 * expression and declare its own import requirements.
 *
 * A top-level renderer walks an array of these polymorphically, concatenates
 * `renderTypeScript()` results, and aggregates `importRequirements()` into a
 * deduplicated import block.
 */
export abstract class TsExpression {
  abstract renderTypeScript(): string;
  abstract importRequirements(): readonly ImportRequirement[];
}

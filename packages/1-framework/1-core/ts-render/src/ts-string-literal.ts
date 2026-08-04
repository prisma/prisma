/**
 * Renders a string as a TypeScript source-text literal.
 *
 * `JSON.stringify` already escapes quotes, backslashes, and control characters
 * exactly as TypeScript needs; it leaves U+2028/U+2029 unescaped, which legacy
 * parsers treat as line terminators, so those are escaped explicitly.
 *
 * Used for both value literals (`jsonToTsSource`) and type-level literals /
 * property keys (the contract emitter), so a physical name that a store admits
 * as a quoted identifier but TypeScript does not admit bare renders the same
 * way everywhere.
 */
export function tsStringLiteral(value: string): string {
  return JSON.stringify(value)
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}

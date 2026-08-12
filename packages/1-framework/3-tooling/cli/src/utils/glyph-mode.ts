export type GlyphMode = 'unicode' | 'ascii';

export interface GlyphModeInput {
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string | undefined>>;
}

function localeString(env: Readonly<Record<string, string | undefined>>): string {
  return env['LC_ALL'] ?? env['LC_CTYPE'] ?? env['LANG'] ?? '';
}

function isUtf8Locale(env: Readonly<Record<string, string | undefined>>): boolean {
  const locale = localeString(env);
  if (locale.length === 0) return false;
  return /UTF-8|utf8/i.test(locale);
}

export function detectGlyphMode(input: GlyphModeInput): GlyphMode {
  if (!input.isTTY) return 'ascii';
  if (!isUtf8Locale(input.env)) return 'ascii';
  return 'unicode';
}

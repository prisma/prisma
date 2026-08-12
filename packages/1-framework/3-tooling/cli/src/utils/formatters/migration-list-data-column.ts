import stringWidth from 'string-width';
import type { GlyphMode } from '../glyph-mode';

export const MIGRATION_LIST_HASH_WIDTH = 7;
export const MIGRATION_LIST_EMPTY_SOURCE = '∅';
export const MIGRATION_LIST_ASCII_EMPTY_SOURCE = '-';
export const MIGRATION_LIST_FORWARD_EDGE_GLYPH = '→';
export const MIGRATION_LIST_ASCII_FORWARD_EDGE_GLYPH = '->';

export function migrationListForwardArrow(glyphMode: GlyphMode): string {
  return glyphMode === 'ascii'
    ? MIGRATION_LIST_ASCII_FORWARD_EDGE_GLYPH
    : MIGRATION_LIST_FORWARD_EDGE_GLYPH;
}

export function migrationListEmptySource(glyphMode: GlyphMode): string {
  return glyphMode === 'ascii' ? MIGRATION_LIST_ASCII_EMPTY_SOURCE : MIGRATION_LIST_EMPTY_SOURCE;
}

export function abbreviateContractHash(hash: string): string {
  return hash.slice(0, MIGRATION_LIST_HASH_WIDTH);
}

export function padFromHashColumn(text: string, width: number): string {
  const padding = Math.max(0, width - stringWidth(text));
  return `${' '.repeat(padding)}${text}`;
}

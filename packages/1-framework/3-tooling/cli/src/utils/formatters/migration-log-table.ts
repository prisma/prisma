import type { LedgerEntryRecord } from '@internal/contract/types';
import stringWidth from 'string-width';
import type { GlyphMode } from '../glyph-mode';
import {
  abbreviateContractHash,
  migrationListEmptySource,
  migrationListForwardArrow,
} from './migration-list-data-column';
import { IDENTITY_MIGRATION_LIST_STYLER, type MigrationListStyler } from './migration-list-render';

export type LedgerTimestampMode = 'local' | 'utc' | 'iso';

export interface RenderMigrationLogTableOptions {
  readonly utc?: boolean;
  readonly styler?: MigrationListStyler;
  readonly glyphMode?: GlyphMode;
}

export interface SerializedLedgerEntryRecord {
  readonly space: string;
  readonly name: string;
  readonly hash: string;
  readonly fromContract: string | null;
  readonly toContract: string;
  readonly appliedAt: string;
  readonly operationCount: number;
}

const HEADING_APPLIED_AT = 'Applied at';
const HEADING_SPACE = 'Space';
const HEADING_MIGRATION = 'Migration';
const HEADING_CHANGE = 'Change';
const HEADING_OPS = 'Ops';
const COLUMN_SEPARATOR = ' ';
const DIVIDER_CHAR = '─';
const ASCII_DIVIDER_CHAR = '-';

export function sortLedgerEntries(entries: readonly LedgerEntryRecord[]): LedgerEntryRecord[] {
  return [...entries].sort((left, right) => {
    const timeDiff = left.appliedAt.getTime() - right.appliedAt.getTime();
    if (timeDiff !== 0) {
      return timeDiff;
    }
    const spaceDiff = left.space.localeCompare(right.space);
    if (spaceDiff !== 0) {
      return spaceDiff;
    }
    return left.migrationName.localeCompare(right.migrationName);
  });
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

export function formatLedgerAppliedAt(date: Date, mode: LedgerTimestampMode): string {
  if (mode === 'iso') {
    return date.toISOString();
  }
  if (mode === 'utc') {
    return `${date.getUTCFullYear()}-${pad2(date.getUTCMonth() + 1)}-${pad2(date.getUTCDate())} ${pad2(date.getUTCHours())}:${pad2(date.getUTCMinutes())}:${pad2(date.getUTCSeconds())}Z`;
  }
  const offsetMinutes = -date.getTimezoneOffset();
  const sign = offsetMinutes >= 0 ? '+' : '-';
  const absoluteOffset = Math.abs(offsetMinutes);
  const offsetHours = pad2(Math.floor(absoluteOffset / 60));
  const offsetMins = pad2(absoluteOffset % 60);
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())} ${sign}${offsetHours}:${offsetMins}`;
}

export function formatHashEndpoint(hash: string | null, glyphMode: GlyphMode = 'unicode'): string {
  if (hash === null) {
    return migrationListEmptySource(glyphMode);
  }
  return abbreviateContractHash(hash);
}

export function formatHashTransition(
  from: string | null,
  to: string,
  glyphMode: GlyphMode = 'unicode',
): string {
  return `${formatHashEndpoint(from, glyphMode)} ${migrationListForwardArrow(glyphMode)} ${abbreviateContractHash(to)}`;
}

export function styleHashTransition(
  from: string | null,
  to: string,
  styler: MigrationListStyler,
  glyphMode: GlyphMode = 'unicode',
): string {
  const fromPart =
    from === null
      ? styler.glyph(migrationListEmptySource(glyphMode))
      : styler.sourceHash(abbreviateContractHash(from));
  const arrow = styler.glyph(migrationListForwardArrow(glyphMode));
  const dest = styler.destHash(abbreviateContractHash(to));
  return `${fromPart} ${arrow} ${dest}`;
}

function padVisible(text: string, targetWidth: number): string {
  const padding = Math.max(0, targetWidth - stringWidth(text));
  return text + ' '.repeat(padding);
}

function columnWidth(values: readonly string[]): number {
  return values.reduce((max, value) => Math.max(max, stringWidth(value)), 0);
}

function padDividerCell(valueWidth: number, dividerChar: string): string {
  return dividerChar.repeat(valueWidth + 2);
}

function padTextCell(value: string, valueWidth: number): string {
  return ` ${padVisible(value, valueWidth)} `;
}

function padOpsCell(value: string, valueWidth: number): string {
  const padding = Math.max(0, valueWidth - stringWidth(value));
  return ` ${' '.repeat(padding)}${value} `;
}

export function renderMigrationLogTable(
  entries: readonly LedgerEntryRecord[],
  options: RenderMigrationLogTableOptions = {},
): string {
  const sorted = sortLedgerEntries(entries);
  if (sorted.length === 0) {
    return '';
  }

  const styler = options.styler ?? IDENTITY_MIGRATION_LIST_STYLER;
  const glyphMode = options.glyphMode ?? 'unicode';
  const dividerChar = glyphMode === 'ascii' ? ASCII_DIVIDER_CHAR : DIVIDER_CHAR;
  const showSpace = new Set(sorted.map((entry) => entry.space)).size > 1;
  const timestampMode: LedgerTimestampMode = options.utc ? 'utc' : 'local';
  const rows = sorted.map((entry) => ({
    appliedAt: formatLedgerAppliedAt(entry.appliedAt, timestampMode),
    space: entry.space,
    migrationName: entry.migrationName,
    transition: formatHashTransition(entry.from, entry.to, glyphMode),
    ops: `${entry.operationCount} ops`,
    from: entry.from,
    to: entry.to,
  }));

  const appliedAtWidth = columnWidth([HEADING_APPLIED_AT, ...rows.map((row) => row.appliedAt)]);
  const spaceWidth = showSpace ? columnWidth([HEADING_SPACE, ...rows.map((row) => row.space)]) : 0;
  const nameWidth = columnWidth([HEADING_MIGRATION, ...rows.map((row) => row.migrationName)]);
  const transitionWidth = columnWidth([HEADING_CHANGE, ...rows.map((row) => row.transition)]);
  const opsWidth = columnWidth([HEADING_OPS, ...rows.map((row) => row.ops)]);

  const headingParts = [padTextCell(HEADING_APPLIED_AT, appliedAtWidth)];
  if (showSpace) {
    headingParts.push(padTextCell(HEADING_SPACE, spaceWidth));
  }
  headingParts.push(
    padTextCell(HEADING_MIGRATION, nameWidth),
    padTextCell(HEADING_CHANGE, transitionWidth),
    padOpsCell(HEADING_OPS, opsWidth),
  );
  const heading = headingParts.join(COLUMN_SEPARATOR);

  const dividerParts = [padDividerCell(appliedAtWidth, dividerChar)];
  if (showSpace) {
    dividerParts.push(padDividerCell(spaceWidth, dividerChar));
  }
  dividerParts.push(
    padDividerCell(nameWidth, dividerChar),
    padDividerCell(transitionWidth, dividerChar),
    padDividerCell(opsWidth, dividerChar),
  );
  const divider = dividerParts.map((cell) => styler.summary(cell)).join(COLUMN_SEPARATOR);

  const dataRows = rows.map((row) => {
    const parts = [padTextCell(row.appliedAt, appliedAtWidth)];
    if (showSpace) {
      parts.push(padTextCell(row.space, spaceWidth));
    }
    parts.push(
      padTextCell(styler.dirName(row.migrationName), nameWidth),
      padTextCell(styleHashTransition(row.from, row.to, styler, glyphMode), transitionWidth),
      padOpsCell(row.ops, opsWidth),
    );
    return parts.join(COLUMN_SEPARATOR);
  });

  return [heading, divider, ...dataRows].join('\n');
}

export function serializeLedgerEntriesForJson(
  entries: readonly LedgerEntryRecord[],
): SerializedLedgerEntryRecord[] {
  return sortLedgerEntries(entries).map((entry) => ({
    space: entry.space,
    name: entry.migrationName,
    hash: entry.migrationHash,
    fromContract: entry.from,
    toContract: entry.to,
    appliedAt: formatLedgerAppliedAt(entry.appliedAt, 'iso'),
    operationCount: entry.operationCount,
  }));
}

export const MIGRATION_LOG_EMPTY_MESSAGE = 'No migrations have been applied to this database.';

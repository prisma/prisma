import type { ContractSpaceAggregate } from '@internal/migration-tools/aggregate';
import type { MigrationGraph } from '@internal/migration-tools/graph';
import type { MigrationSpaceListEntry } from '../../commands/json/schemas';
import { listRefsByContractHash } from '../../control-api/operations/migration-list';
import type { GlyphMode } from '../glyph-mode';
import type { MigrationGraphPalette } from './migration-graph-palette';
import {
  computeGlobalMaxDirNameWidth,
  computeGlobalMaxEdgeTreePrefixWidth,
  indentMigrationGraphTreeBlock,
  renderMigrationGraphSpaceTree,
} from './migration-graph-space-render';
import type { MigrationListStyler } from './migration-list-render';

export interface MigrationGraphTreeSection {
  readonly space: string;
  readonly tree: string;
  readonly showHeading: boolean;
}

/**
 * One tree per in-scope contract space. Widths are computed across every space
 * first so multi-space sections align with each other.
 */
export function buildMigrationGraphTreeSections(inputs: {
  readonly aggregate: ContractSpaceAggregate;
  readonly scopedSpaces: readonly MigrationSpaceListEntry[];
  readonly liveContractHash: string;
  readonly glyphMode: GlyphMode;
  readonly colorize: boolean;
  readonly styler?: MigrationListStyler;
  readonly palette?: MigrationGraphPalette;
}): readonly MigrationGraphTreeSection[] {
  const { aggregate, scopedSpaces, liveContractHash, glyphMode, colorize } = inputs;
  const showSpaceHeadings = scopedSpaces.length > 1;

  const globalLayoutInputs = showSpaceHeadings
    ? scopedSpaces
        .filter((entry) => entry.migrations.length > 0)
        .flatMap((entry) => {
          const graph = aggregate.space(entry.space)?.graph();
          return graph === undefined ? [] : [{ graph, liveContractHash }];
        })
    : [];
  const globalMaxEdgeTreePrefixWidth =
    globalLayoutInputs.length > 0
      ? computeGlobalMaxEdgeTreePrefixWidth(globalLayoutInputs)
      : undefined;
  const globalMaxDirNameWidth =
    globalLayoutInputs.length > 0 ? computeGlobalMaxDirNameWidth(globalLayoutInputs) : undefined;

  const sections: MigrationGraphTreeSection[] = [];
  for (const entry of scopedSpaces) {
    const space = aggregate.space(entry.space);
    if (space === undefined) {
      continue;
    }
    const tree =
      entry.migrations.length === 0
        ? ''
        : renderMigrationGraphSpaceTree({
            graph: space.graph(),
            migrations: entry.migrations,
            liveContractHash,
            glyphMode,
            colorize,
            isAppSpace: entry.space === aggregate.app.spaceId,
            refsByHash: listRefsByContractHash(space),
            ...(inputs.styler !== undefined ? { styler: inputs.styler } : {}),
            ...(inputs.palette !== undefined ? { palette: inputs.palette } : {}),
            ...(globalMaxEdgeTreePrefixWidth !== undefined ? { globalMaxEdgeTreePrefixWidth } : {}),
            ...(globalMaxDirNameWidth !== undefined ? { globalMaxDirNameWidth } : {}),
          });
    sections.push({
      space: entry.space,
      tree: showSpaceHeadings && tree.length > 0 ? indentMigrationGraphTreeBlock(tree, '  ') : tree,
      showHeading: showSpaceHeadings,
    });
  }
  return sections;
}

/** The rendered tree, headings and summary as one block of lines. */
export function renderMigrationGraphSections(
  sections: readonly MigrationGraphTreeSection[],
  summary: string,
): string {
  const lines: string[] = [];
  for (const section of sections) {
    if (section.showHeading) {
      lines.push(`${section.space}:`);
    }
    lines.push(section.tree.length > 0 ? section.tree : '(no migrations)');
    lines.push('');
  }
  lines.push(summary);
  return lines.join('\n').trimEnd();
}

/**
 * Graphviz DOT for the app graph. Node ids are truncated to 12 characters,
 * which is a collision hazard recorded and preserved by the port.
 */
export function renderMigrationGraphDot(graph: MigrationGraph): string {
  const lines = ['digraph migrations {'];
  for (const edge of graph.migrationByHash.values()) {
    lines.push(
      `  "${edge.from.slice(0, 12)}" -> "${edge.to.slice(0, 12)}" [label="${edge.dirName}"];`,
    );
  }
  lines.push('}');
  return lines.join('\n');
}

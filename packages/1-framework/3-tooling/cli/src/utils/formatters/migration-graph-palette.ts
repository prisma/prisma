import { bold, createColors, green, yellow } from 'colorette';
import type { PathRole } from './migration-graph-model';
import { tonePainter } from './tone-markup';

/**
 * Where the migration drawings get their colour. The gutter, the node glyphs
 * and the row labels all read from one palette so a lane's hue reaches the
 * connector, the `○` and the migration name alike.
 */
export interface MigrationGraphPalette {
  /** A branch lane's hue. Lanes rotate through a fixed series. */
  readonly lane: (lane: number, text: string) => string;
  /** A node or line's role on a highlighted path. */
  readonly role: (role: PathRole, text: string) => string;
  /** A name lifted above its neighbours (the active ref, an on-path name). */
  readonly emphasis: (text: string) => string;
  /** Whether a migration has run against the database. */
  readonly status: (status: 'applied' | 'pending', text: string) => string;
}

const LANE_COUNT = 6;

// The gutter's colour is forced on regardless of NO_COLOR, so a test that asks
// for a coloured tree gets one; `emphasis` and `status` decorate label text and
// follow the ambient environment, as they always have.
const forced = createColors({ useColor: true });

const ANSI_LANES = [
  forced.white,
  forced.cyan,
  forced.yellow,
  forced.blueBright,
  forced.magenta,
  forced.green,
] as const;

/** The palette the commander CLI paints with: ANSI SGR straight into the line. */
export const ANSI_MIGRATION_GRAPH_PALETTE: MigrationGraphPalette = {
  lane: (lane, text) => (ANSI_LANES[lane % LANE_COUNT] ?? ((value: string) => value))(text),
  role: (role, text) => (role === 'on-path' ? forced.greenBright(text) : forced.dim(text)),
  emphasis: (text) => bold(text),
  status: (status, text) => (status === 'applied' ? green(text) : yellow(text)),
};

const TONE_LANES = ['color-1', 'color-2', 'color-3', 'color-4', 'color-5', 'color-6'] as const;

/**
 * The palette the engine shell marks with: each run of text carries the tone
 * it means, and the engine chooses the bytes. The lane series maps onto the
 * engine's indexed colours in order, which is the same rotation.
 */
export const TONE_MIGRATION_GRAPH_PALETTE: MigrationGraphPalette = {
  lane: (lane, text) => tonePainter(TONE_LANES[lane % LANE_COUNT] ?? 'color-1')(text),
  role: (role, text) => tonePainter(role === 'on-path' ? 'highlight' : 'muted')(text),
  emphasis: tonePainter('emphasis'),
  status: (status, text) => tonePainter(status === 'applied' ? 'ok' : 'warn')(text),
};

/** The palette a plain, uncoloured render uses: none of it. */
export const PLAIN_MIGRATION_GRAPH_PALETTE: MigrationGraphPalette = {
  lane: (_lane, text) => text,
  role: (_role, text) => text,
  emphasis: (text) => text,
  status: (_status, text) => text,
};

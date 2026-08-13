import type { VerifyDatabaseResult } from '@internal/framework-components/control';

/**
 * What a verify run reports, minus the verdict flag. The engine bin composes
 * its own document around it, whose `ok` carries the verdict either way.
 */
export interface DbVerifyReport {
  readonly mode: 'full' | 'marker-only';
  readonly summary: string;
  readonly contract: VerifyDatabaseResult['contract'];
  readonly marker?: VerifyDatabaseResult['marker'];
  readonly target: VerifyDatabaseResult['target'];
  readonly missingCodecs?: VerifyDatabaseResult['missingCodecs'];
  readonly codecCoverageSkipped?: VerifyDatabaseResult['codecCoverageSkipped'];
  readonly schema?: {
    readonly summary: string;
    readonly strict: boolean;
    /**
     * Warn-graded finding messages (observed-policy drift). Informational —
     * present on a passing verify; the full-mode result summarizes them as a
     * flat message list.
     */
    readonly warnings?: readonly string[];
  };
  /**
   * Live element names no contract space declares. In full success this is
   * only ever non-empty in lenient mode — strict mode fails on it — and is
   * rendered informationally.
   */
  readonly unclaimed?: readonly string[];
  readonly warning?: string;
  readonly meta?:
    | (NonNullable<VerifyDatabaseResult['meta']> & {
        readonly schemaVerification: 'performed' | 'skipped';
      })
    | {
        readonly schemaVerification: 'performed' | 'skipped';
      };
  readonly timings: {
    readonly total: number;
  };
}

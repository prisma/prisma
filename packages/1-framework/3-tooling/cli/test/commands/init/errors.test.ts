import { docsUrlFor } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import { errorInitReinitNeedsForce } from '../../../src/commands/init/errors';

describe('init errors', () => {
  it('errorInitReinitNeedsForce links the canonical error-reference anchor for its code', () => {
    const error = errorInitReinitNeedsForce();
    expect(error.docsUrl).toBe(docsUrlFor('CLI.INIT_REINIT_NEEDS_FORCE'));
  });
});

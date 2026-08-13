import { docsUrlFor } from '@internal/utils/structured-error';
import { describe, expect, it } from 'vitest';
import { errorDriverRequired, errorFamilyReadMarkerSqlRequired } from '../src/utils/cli-errors';

describe('CliStructuredError.toEnvelope()', () => {
  it('converts driver required error to envelope with CONFIG.DRIVER_REQUIRED', () => {
    const error = errorDriverRequired();
    const envelope = error.toEnvelope();

    expect(envelope).toMatchObject({
      code: 'CONFIG.DRIVER_REQUIRED',
      summary: 'Driver is required for DB-connected commands',
      fix: 'Add a control-plane driver to prisma.config.ts (e.g. import a driver descriptor and set `driver: postgresDriver`)',
      docsUrl: docsUrlFor('CONFIG.DRIVER_REQUIRED'),
    });
  });

  it('converts readMarker error to envelope with CONFIG.FAMILY_READ_MARKER_REQUIRED', () => {
    const error = errorFamilyReadMarkerSqlRequired();
    const envelope = error.toEnvelope();

    expect(envelope).toMatchObject({
      code: 'CONFIG.FAMILY_READ_MARKER_REQUIRED',
      summary: 'Family readMarker() is required',
      fix: 'Ensure family.verify.readMarker() is exported by your family package',
      docsUrl: docsUrlFor('CONFIG.FAMILY_READ_MARKER_REQUIRED'),
    });
  });
});

import { describe, expect, it } from 'vitest';
import { postgisGeometryDescriptor } from '../src/core/codecs';

describe('postgis codec renderOutputType', () => {
  const renderOutputType = postgisGeometryDescriptor.renderOutputType as
    | ((typeParams: Record<string, unknown>) => string | undefined)
    | undefined;

  // The descriptor's `renderOutputType` runs *after* `paramsSchema`
  // validation so it can assume a well-formed `srid`. Negative-shape
  // inputs (NaN / non-integer / negative) are rejected upstream by
  // `paramsSchema` and never reach this renderer.

  it('renders Geometry<srid> when srid is present', () => {
    expect(renderOutputType?.({ srid: 4326 })).toBe('Geometry<4326>');
  });

  it('renders Geometry when srid is absent (representative codec)', () => {
    expect(renderOutputType?.({})).toBe('Geometry');
  });
});

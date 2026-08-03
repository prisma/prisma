export const QUERY_IDS = ['near', 'within', 'contains', 'soma', 'intersect', 'bbox'] as const;
export type QueryId = (typeof QUERY_IDS)[number];

export const DEFAULT_QUERY: QueryId = 'near';

export type QueryKind = 'cafe' | 'neighborhood' | 'route';
export type QueryGroup = 'point' | 'fixed';

export type QueryMeta = {
  id: QueryId;
  fn: string;
  title: string;
  tagline: string;
  blurb: string;
  postgis: string;
  snippet: string;
  kind: QueryKind;
  group: QueryGroup;
};

/**
 * Query strings displayed in the UI, not executed.
 */
export const QUERY_META: Record<QueryId, QueryMeta> = {
  near: {
    id: 'near',
    fn: 'findCafesNearPoint',
    title: 'Nearest cafes',
    tagline: 'The N closest cafes to a point you choose',
    blurb:
      'Order all cafes by spherical distance to the query point and return the closest few. Distance comes back in metres so you can show "how far".',
    postgis: 'ST_DistanceSphere · ORDER BY · LIMIT',
    snippet: `db.sql.public.cafe
  .select('id', 'name')
  .select('meters', (f, fns) => fns.distanceSphere(f.location, point))
  .orderBy((f, fns) => fns.distanceSphere(f.location, point), { direction: 'asc' })
  .limit(limit)`,
    kind: 'cafe',
    group: 'point',
  },
  within: {
    id: 'within',
    fn: 'findCafesWithinRadius',
    title: 'Cafes within radius',
    tagline: 'Every cafe inside a circle of N metres',
    blurb:
      'Filter cafes whose spherical distance to the query point is at most N metres. The yellow ring on the map shows the search circle.',
    postgis: 'ST_DistanceSphere(location, $point) ≤ $metres',
    snippet: `db.sql.public.cafe
  .select('id', 'name')
  .where((f, fns) => fns.lte(fns.distanceSphere(f.location, point), metres))
  .limit(limit)`,
    kind: 'cafe',
    group: 'point',
  },
  contains: {
    id: 'contains',
    fn: 'findNeighborhoodForPoint',
    title: 'Reverse geocode',
    tagline: 'Which neighborhood does this point fall inside?',
    blurb:
      'Find the neighborhood polygon that contains the query point. Returns at most one match for our SF dataset.',
    postgis: 'ST_Contains(boundary, $point)',
    snippet: `db.sql.public.neighborhood
  .select('id', 'name')
  .where((f, fns) => fns.contains(f.boundary, point))`,
    kind: 'neighborhood',
    group: 'point',
  },
  soma: {
    id: 'soma',
    fn: 'findCafesInNeighborhood',
    title: 'Cafes inside SoMa',
    tagline: 'All cafes whose location falls inside the SoMa polygon',
    blurb:
      'Spatial join from cafes to a fixed neighborhood polygon (SoMa). The violet outline on the map shows the polygon being matched against.',
    postgis: 'ST_Within(location, $boundary)',
    snippet: `db.sql.public.cafe
  .select('id', 'name')
  .where((f, fns) => fns.within(f.location, boundary))`,
    kind: 'cafe',
    group: 'fixed',
  },
  intersect: {
    id: 'intersect',
    fn: 'findRoutesIntersecting',
    title: 'Routes crossing a closure',
    tagline: 'Which routes pass through a fixed downtown closure?',
    blurb:
      'Detect line/polygon intersection between bus routes and a closure polygon. Useful for impact analysis when streets shut down.',
    postgis: 'ST_Intersects(path, $closure)',
    snippet: `db.sql.public.route
  .select('id', 'name')
  .where((f, fns) => fns.intersects(f.path, other))`,
    kind: 'route',
    group: 'fixed',
  },
  bbox: {
    id: 'bbox',
    fn: 'findCafesInBbox',
    title: 'Cafes in viewport',
    tagline: 'Cheap bounding-box filter — perfect for map panning',
    blurb:
      'Use the index-friendly && operator to filter by a rectangle. This is what you would call as the user pans/zooms a real map.',
    postgis: '&& (intersectsBbox)',
    snippet: `db.sql.public.cafe
  .select('id', 'name')
  .where((f, fns) => fns.intersectsBbox(f.location, envelope))`,
    kind: 'cafe',
    group: 'fixed',
  },
};

export function parseQueryId(value: string | string[] | undefined): QueryId {
  const raw = Array.isArray(value) ? value[0] : value;
  return (QUERY_IDS as ReadonlyArray<string>).includes(raw ?? '')
    ? (raw as QueryId)
    : DEFAULT_QUERY;
}

export const QUERY_GROUPS: ReadonlyArray<{ id: QueryGroup; label: string; hint: string }> = [
  {
    id: 'point',
    label: 'From a point you choose',
    hint: 'Click the map or pick a preset.',
  },
  { id: 'fixed', label: 'Against a fixed shape', hint: 'No input — runs on a sample shape.' },
];

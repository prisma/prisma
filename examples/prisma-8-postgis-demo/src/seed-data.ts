/**
 * Tiny, hand-curated PostGIS dataset focused on San Francisco. The
 * coordinates are real (street-level accurate enough for query examples)
 * so the spatial relationships in the README narrative actually hold.
 */

import { bboxPolygon, point, polygon } from '@prisma/orm-extension-postgis/geojson';

export const cafes = [
  {
    id: '00000000-0000-0000-0000-000000000001',
    name: 'Sightglass Coffee',
    location: point(-122.4106, 37.7765, 4326),
  },
  {
    id: '00000000-0000-0000-0000-000000000002',
    name: 'Blue Bottle (Mint Plaza)',
    location: point(-122.4079, 37.7833, 4326),
  },
  {
    id: '00000000-0000-0000-0000-000000000003',
    name: 'Réveille Polk',
    location: point(-122.4197, 37.7912, 4326),
  },
  {
    id: '00000000-0000-0000-0000-000000000004',
    name: 'Ritual (Mission)',
    location: point(-122.4234, 37.7615, 4326),
  },
  {
    id: '00000000-0000-0000-0000-000000000005',
    name: 'Andytown (Outer Sunset)',
    location: point(-122.4955, 37.7464, 4326),
  },
] as const;

export const neighborhoods = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'SoMa',
    boundary: polygon(
      [
        [-122.418, 37.77],
        [-122.4, 37.77],
        [-122.4, 37.785],
        [-122.418, 37.785],
        [-122.418, 37.77],
      ],
      4326,
    ),
  },
  {
    id: '10000000-0000-0000-0000-000000000002',
    name: 'Mission',
    boundary: polygon(
      [
        [-122.43, 37.755],
        [-122.41, 37.755],
        [-122.41, 37.77],
        [-122.43, 37.77],
        [-122.43, 37.755],
      ],
      4326,
    ),
  },
  {
    id: '10000000-0000-0000-0000-000000000003',
    name: 'Outer Sunset',
    boundary: bboxPolygon([-122.51, 37.74, -122.485, 37.76], 4326),
  },
] as const;

export const routes = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    name: 'Market Street stroll',
    path: {
      type: 'LineString' as const,
      coordinates: [
        [-122.4194, 37.7793],
        [-122.4106, 37.7857],
        [-122.4015, 37.7894],
      ],
      srid: 4326,
    },
  },
  {
    id: '20000000-0000-0000-0000-000000000002',
    name: 'Mission loop',
    path: {
      type: 'LineString' as const,
      coordinates: [
        [-122.421, 37.7615],
        [-122.418, 37.762],
        [-122.418, 37.766],
        [-122.421, 37.7615],
      ],
      srid: 4326,
    },
  },
] as const;

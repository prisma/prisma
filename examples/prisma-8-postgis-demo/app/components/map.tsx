'use client';

import 'leaflet/dist/leaflet.css';
import { useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  Rectangle,
  TileLayer,
  useMapEvents,
} from 'react-leaflet';
import type { QueryId } from '../lib/queries-meta';

type LngLat = readonly [number, number];

type Cafe = { id: string; name: string; location: { coordinates: LngLat } };
type Neighborhood = {
  id: string;
  name: string;
  boundary: { coordinates: ReadonlyArray<ReadonlyArray<LngLat>> };
};
type Route = {
  id: string;
  name: string;
  path: { coordinates: ReadonlyArray<LngLat> };
};

type Highlight = {
  cafeIds?: ReadonlySet<string>;
  neighborhoodIds?: ReadonlySet<string>;
  routeIds?: ReadonlySet<string>;
};

type Props = {
  cafes: ReadonlyArray<Cafe>;
  neighborhoods: ReadonlyArray<Neighborhood>;
  routes: ReadonlyArray<Route>;
  activeQuery: QueryId;
  highlight: Highlight;
  queryPoint: LngLat;
  radiusMeters?: number | undefined;
  bbox?: readonly [number, number, number, number] | undefined;
  closurePolygon?: ReadonlyArray<LngLat> | undefined;
  somaBoundary?: ReadonlyArray<LngLat> | undefined;
};

const FOCUS = { lat: 37.78, lng: -122.43 } as const;
const MAP_STYLE: React.CSSProperties = { height: '100%', width: '100%', borderRadius: 12 };

// Eclipse palette: ORM (indigo) for cafes, violet for areas, warning (orange) for routes/point.
const HL_CAFE = '#4f46e5';
const HL_AREA = '#7c3aed';
const HL_ROUTE = '#ea580c';
const DIM_CAFE = '#9ca3af';
const DIM_AREA = '#d1d5db';
const DIM_ROUTE = '#d1d5db';
const POINT_COLOR = '#ea580c';

function toLatLng([lng, lat]: LngLat): [number, number] {
  return [lat, lng];
}

function ringToLatLngs(ring: ReadonlyArray<LngLat>): Array<[number, number]> {
  return ring.map(toLatLng);
}

function ClickHandler({ onClick }: { onClick: (lngLat: LngLat) => void }) {
  useMapEvents({
    click(e) {
      onClick([e.latlng.lng, e.latlng.lat]);
    },
  });
  return null;
}

export function PostgisMap(props: Props) {
  const {
    cafes,
    neighborhoods,
    routes,
    activeQuery,
    highlight,
    queryPoint,
    radiusMeters,
    bbox,
    closurePolygon,
    somaBoundary,
  } = props;

  const router = useRouter();
  const searchParams = useSearchParams();

  const onMapClick = ([lng, lat]: LngLat) => {
    if (!queryPointActive(activeQuery)) return;
    const next = new URLSearchParams(searchParams.toString());
    next.set('lng', lng.toFixed(5));
    next.set('lat', lat.toFixed(5));
    router.push(`?${next.toString()}`);
  };

  const showQueryPoint = queryPointActive(activeQuery);
  const showRadius = activeQuery === 'within' && radiusMeters !== undefined;
  const showBbox = activeQuery === 'bbox' && bbox !== undefined;
  const showClosure = activeQuery === 'intersect' && closurePolygon !== undefined;
  const showSoma = activeQuery === 'soma' && somaBoundary !== undefined;

  const cafeMarkers = useMemo(
    () =>
      cafes.map((cafe) => {
        const isHit = highlight.cafeIds?.has(cafe.id) ?? false;
        return (
          <CircleMarker
            key={cafe.id}
            center={toLatLng(cafe.location.coordinates)}
            radius={isHit ? 8 : 5}
            pathOptions={{
              color: isHit ? '#ffffff' : DIM_CAFE,
              weight: isHit ? 2 : 1,
              fillColor: isHit ? HL_CAFE : DIM_CAFE,
              fillOpacity: isHit ? 1 : 0.6,
            }}
          >
            <title>{cafe.name}</title>
          </CircleMarker>
        );
      }),
    [cafes, highlight.cafeIds],
  );

  const hoodPolygons = useMemo(
    () =>
      neighborhoods.map((hood) => {
        const isHit = highlight.neighborhoodIds?.has(hood.id) ?? false;
        const ring = hood.boundary.coordinates[0];
        if (!ring) return null;
        return (
          <Polygon
            key={hood.id}
            positions={ringToLatLngs(ring)}
            pathOptions={{
              color: isHit ? HL_AREA : DIM_AREA,
              weight: isHit ? 2 : 1,
              fillColor: isHit ? HL_AREA : DIM_AREA,
              fillOpacity: isHit ? 0.2 : 0.04,
              dashArray: isHit ? undefined : '4 4',
            }}
          />
        );
      }),
    [neighborhoods, highlight.neighborhoodIds],
  );

  const routePolylines = useMemo(
    () =>
      routes.map((route) => {
        const isHit = highlight.routeIds?.has(route.id) ?? false;
        return (
          <Polyline
            key={route.id}
            positions={ringToLatLngs(route.path.coordinates)}
            pathOptions={{
              color: isHit ? HL_ROUTE : DIM_ROUTE,
              weight: isHit ? 5 : 2,
              opacity: isHit ? 1 : 0.7,
              dashArray: isHit ? undefined : '6 4',
            }}
          />
        );
      }),
    [routes, highlight.routeIds],
  );

  return (
    <MapContainer
      center={[FOCUS.lat, FOCUS.lng]}
      zoom={13}
      style={MAP_STYLE}
      scrollWheelZoom={false}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}@2x.png"
      />

      <ClickHandler onClick={onMapClick} />

      {hoodPolygons}

      {showSoma && somaBoundary ? (
        <Polygon
          positions={ringToLatLngs(somaBoundary)}
          pathOptions={{ color: HL_AREA, weight: 2, fillColor: HL_AREA, fillOpacity: 0.18 }}
        />
      ) : null}

      {showClosure && closurePolygon ? (
        <Polygon
          positions={ringToLatLngs(closurePolygon)}
          pathOptions={{
            color: HL_ROUTE,
            weight: 2,
            fillColor: HL_ROUTE,
            fillOpacity: 0.15,
            dashArray: '6 4',
          }}
        />
      ) : null}

      {showBbox && bbox ? (
        <Rectangle
          bounds={[
            [bbox[1], bbox[0]],
            [bbox[3], bbox[2]],
          ]}
          pathOptions={{
            color: HL_AREA,
            weight: 2,
            fillColor: HL_AREA,
            fillOpacity: 0.12,
            dashArray: '6 4',
          }}
        />
      ) : null}

      {routePolylines}
      {cafeMarkers}

      {showQueryPoint ? (
        <>
          {showRadius && radiusMeters !== undefined ? (
            <Circle
              center={toLatLng(queryPoint)}
              radius={radiusMeters}
              pathOptions={{
                color: POINT_COLOR,
                weight: 1,
                fillColor: POINT_COLOR,
                fillOpacity: 0.1,
                dashArray: '3 3',
              }}
            />
          ) : null}
          <CircleMarker
            center={toLatLng(queryPoint)}
            radius={7}
            pathOptions={{
              color: '#ffffff',
              weight: 2,
              fillColor: POINT_COLOR,
              fillOpacity: 1,
            }}
          />
        </>
      ) : null}
    </MapContainer>
  );
}

function queryPointActive(q: QueryId): boolean {
  return q === 'near' || q === 'within' || q === 'contains';
}

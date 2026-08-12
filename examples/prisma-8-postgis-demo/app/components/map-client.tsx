'use client';

import nextDynamic from 'next/dynamic';

export const PostgisMap = nextDynamic(() => import('./map').then((m) => m.PostgisMap), {
  ssr: false,
  loading: () => <div className="map-skeleton">Loading map…</div>,
});

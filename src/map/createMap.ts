import { Map as MLMap, setWorkerUrl, type Map } from 'maplibre-gl';
// MapLibre 6 runs its tile worker from a separate file; tell it where Vite put that file.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import 'maplibre-gl/dist/maplibre-gl.css';

import { TELANGANA_BOUNDS } from './telangana';

setWorkerUrl(workerUrl);

export function createMap(container: HTMLElement): Promise<Map> {
  const map = new MLMap({
    container,
    style: '/map/style.json',
    bounds: TELANGANA_BOUNDS, // the intro starts on the whole state, behind the splash
    fitBoundsOptions: { padding: 24 },
    minZoom: 3, // raised to 6.5 (with max bounds) once the intro hands over: see limitMap()
    maxZoom: 17,
    dragRotate: false,
    pitchWithRotate: false,
    touchPitch: false,
    attributionControl: { compact: true },
    fadeDuration: 150,
    // Phones above 2× gain little visible sharpness from a bigger canvas but pay for it in rendering time.
    pixelRatio: Math.min(devicePixelRatio, 2),
    renderWorldCopies: false,
  });
  map.touchZoomRotate.disableRotation();
  return new Promise((resolve, reject) => {
    map.once('load', async () => {
      const tg = await (await fetch('/geo/telangana.geojson')).json();
      map.addSource('telangana', { type: 'geojson', data: tg });
      const below = map.getStyle().layers.find((l: { type: string; id: string }) => l.type === 'symbol')?.id;
      // Both start hidden; the intro fades them in with the splash. The fill fades out as you zoom in.
      map.addLayer({ id: 'tg-fill', type: 'fill', source: 'telangana',
        paint: { 'fill-color': '#1F4D3A', 'fill-opacity': 0, 'fill-opacity-transition': { duration: 400 } } }, below);
      map.addLayer({ id: 'tg-line', type: 'line', source: 'telangana',
        paint: { 'line-color': '#1F4D3A', 'line-width': 1.5, 'line-opacity': 0, 'line-opacity-transition': { duration: 400 } } }, below);
      resolve(map);
    });
    map.once('error', (e) => reject((e as unknown as { error: Error }).error));
  });
}

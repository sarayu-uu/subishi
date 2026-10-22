import type { Map } from 'maplibre-gl'; // type-only: keeps MapLibre out of the first bundle

export const TELANGANA_BOUNDS: [[number, number], [number, number]] = [[77.24, 15.84], [81.32, 19.92]];
/** Hyderabad inside the Outer Ring Road: where the intro lands. */
export const HYDERABAD_BOUNDS: [[number, number], [number, number]] = [[78.25, 17.25], [78.65, 17.6]];

/** Show Telangana, then let the fill fade as you zoom in. */
export function revealTelangana(map: Map) {
  map.setPaintProperty('tg-line', 'line-opacity', ['interpolate', ['linear'], ['zoom'], 6, 0.9, 10, 0.35]);
  map.setPaintProperty('tg-fill', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 6, 0.12, 9, 0]);
}

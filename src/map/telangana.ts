import type { Map } from 'maplibre-gl'; // type-only: keeps MapLibre out of the first bundle

export const TELANGANA_BOUNDS: [[number, number], [number, number]] = [[77.24, 15.84], [81.32, 19.92]];
/** Where the map may go once you are in control: Telangana plus about 1° on every side. */
export const LIMIT_BOUNDS: [[number, number], [number, number]] = [[76.24, 14.84], [82.32, 20.92]];
export const MIN_ZOOM = 6.5;
/** Hyderabad centre (Hussain Sagar): projects within 60 km of it frame the end of the intro. */
export const HYDERABAD: { lat: number; lng: number } = { lat: 17.42291, lng: 78.47542 };

/** Show Telangana: outline and soft tint fade in (400 ms), and the tint fades out again as you zoom in. */
export function revealTelangana(map: Map) {
  map.setPaintProperty('tg-line', 'line-opacity', ['interpolate', ['linear'], ['zoom'], 6, 0.9, 10, 0.35]);
  map.setPaintProperty('tg-fill', 'fill-opacity', ['interpolate', ['linear'], ['zoom'], 6, 0.12, 9, 0]);
}

/**
 * Keep people from drifting off to the rest of India. Applied after the intro: on a portrait phone the opening
 * Telangana view sits around zoom 5.8, below these limits, so applying them earlier would crop the state.
 */
export function limitMap(map: Map) {
  map.setMinZoom(MIN_ZOOM);
  map.setMaxBounds(LIMIT_BOUNDS);
}

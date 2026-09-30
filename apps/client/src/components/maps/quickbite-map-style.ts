/** Premium QuickBite tracking basemap — local MapLibre style; brand accents from shared tokens. */
import { brandHex } from '../../../../../packages/shared/src/brand-tokens';

export const ROUTE_ORANGE = brandHex.primary;
export const MAP_LAND = brandHex.background;
export const MAP_LAND_ALT = brandHex.border;

export const QUICKBITE_MAP_STYLE = {
  version: 8 as const,
  name: 'QuickBite Tracking',
  glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
  sources: {
    openmaptiles: {
      type: 'vector' as const,
      url: 'https://tiles.openfreemap.org/planet',
    },
  },
  layers: [
    {
      id: 'background',
      type: 'background' as const,
      paint: { 'background-color': MAP_LAND },
    },
    {
      id: 'landcover-grass',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', 'class', 'grass'],
      paint: { 'fill-color': '#E8EDE4', 'fill-opacity': 0.7 },
    },
    {
      id: 'landcover-wood',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'landcover',
      filter: ['==', 'class', 'wood'],
      paint: { 'fill-color': '#DEE6D8', 'fill-opacity': 0.75 },
    },
    {
      id: 'park',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'park',
      paint: { 'fill-color': '#E2EAD9', 'fill-opacity': 0.85 },
    },
    {
      id: 'landuse-residential',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'landuse',
      filter: ['==', 'class', 'residential'],
      paint: { 'fill-color': MAP_LAND_ALT, 'fill-opacity': 0.55 },
    },
    {
      id: 'water',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'water',
      paint: { 'fill-color': '#D7E4EE', 'fill-opacity': 1 },
    },
    {
      id: 'waterway',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'waterway',
      paint: { 'line-color': '#C9DBE8', 'line-width': 1 },
    },
    {
      id: 'building',
      type: 'fill' as const,
      source: 'openmaptiles',
      'source-layer': 'building',
      minzoom: 14,
      paint: { 'fill-color': '#EEEBE6', 'fill-opacity': 0.45, 'fill-outline-color': '#E4E0DA' },
    },
    {
      id: 'road-minor',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'minor', 'service', 'path', 'track']],
      paint: {
        'line-color': '#E4E2DE',
        'line-width': ['interpolate', ['linear'], ['zoom'], 12, 0.4, 16, 1.6],
      },
    },
    {
      id: 'road-secondary',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'secondary', 'tertiary']],
      paint: {
        'line-color': '#DDDBD6',
        'line-width': ['interpolate', ['linear'], ['zoom'], 10, 0.6, 16, 2.4],
      },
    },
    {
      id: 'road-primary',
      type: 'line' as const,
      source: 'openmaptiles',
      'source-layer': 'transportation',
      filter: ['all', ['==', '$type', 'LineString'], ['in', 'class', 'primary', 'trunk', 'motorway']],
      paint: {
        'line-color': '#D4D1CB',
        'line-width': ['interpolate', ['linear'], ['zoom'], 8, 0.8, 16, 3.2],
      },
    },
    {
      id: 'place-label',
      type: 'symbol' as const,
      source: 'openmaptiles',
      'source-layer': 'place',
      minzoom: 11,
      filter: ['in', 'class', 'suburb', 'neighbourhood', 'village'],
      layout: {
        'text-field': '{name}',
        'text-font': ['Noto Sans Regular'],
        'text-size': 11,
        'text-max-width': 8,
        'text-padding': 2,
      },
      paint: {
        'text-color': '#B0AAA2',
        'text-halo-color': MAP_LAND,
        'text-halo-width': 1.2,
      },
    },
  ],
};

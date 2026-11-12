import type {
  ActiveShape,
  AtlasUrlPayload,
  Country,
  MapView,
  ShapeColor,
  Units,
} from '../types';

export const EARTH_RADIUS_KM = 6371.0088;
export const WORLD_TILE_SIZE = 256;
export const MAX_SHAPES = 12;

export const DEFAULT_VIEW: MapView = {
  lat: 18,
  lng: 8,
  zoom: 2.3,
};

export const SHAPE_COLORS: ShapeColor[] = [
  { id: 'rust', name: 'Vermilion', hex: '#C4472D' },
  { id: 'cobalt', name: 'Cobalt', hex: '#245B7A' },
  { id: 'ochre', name: 'Ochre', hex: '#B9822A' },
  { id: 'forest', name: 'Forest', hex: '#3F6B4F' },
  { id: 'plum', name: 'Plum', hex: '#7B4C64' },
  { id: 'teal', name: 'Teal', hex: '#2B746F' },
  { id: 'umber', name: 'Umber', hex: '#8B5A35' },
  { id: 'indigo', name: 'Indigo', hex: '#4B5B91' },
];

export const COLOR_BY_ID = new Map(
  SHAPE_COLORS.map((color) => [color.id, color]),
);

const areaFormatters = new Map<string, Intl.NumberFormat>();

function getAreaFormatter(units: Units, maximumFractionDigits: number) {
  const key = `${units}-${maximumFractionDigits}`;
  let formatter = areaFormatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      maximumFractionDigits,
      minimumFractionDigits: 0,
    });
    areaFormatters.set(key, formatter);
  }
  return formatter;
}

export function squareMiles(areaKm: number) {
  return areaKm * 0.3861021585;
}

export function formatArea(areaKm: number, units: Units) {
  const value = units === 'mi' ? squareMiles(areaKm) : areaKm;
  const digits = value < 10 ? 1 : 0;
  return `${getAreaFormatter(units, digits).format(value)} ${
    units === 'mi' ? 'mi²' : 'km²'
  }`;
}

export function formatAreaCompact(areaKm: number, units: Units) {
  const value = units === 'mi' ? squareMiles(areaKm) : areaKm;
  const suffix = units === 'mi' ? 'mi²' : 'km²';
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M ${suffix}`;
  }
  if (value >= 10_000) {
    return `${Math.round(value / 1000)}k ${suffix}`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k ${suffix}`;
  }
  return `${getAreaFormatter(units, 1).format(value)} ${suffix}`;
}

export function formatRatio(value: number) {
  if (value >= 100) return value.toFixed(0);
  if (value >= 10) return value.toFixed(1);
  return value.toFixed(2).replace(/0$/, '');
}

export function formatLatitude(lat: number) {
  if (Math.abs(lat) < 0.05) return '0.0°';
  return `${Math.abs(lat).toFixed(1)}° ${lat > 0 ? 'N' : 'S'}`;
}

export function formatLongitude(lng: number) {
  const normalized = wrapLongitude(lng);
  if (Math.abs(normalized) < 0.05) return '0.0°';
  return `${Math.abs(normalized).toFixed(1)}° ${
    normalized > 0 ? 'E' : 'W'
  }`;
}

export function wrapLongitude(lng: number) {
  let value = lng;
  while (value > 180) value -= 360;
  while (value < -180) value += 360;
  return value;
}

export function clampLatitude(lat: number) {
  return Math.max(-84.5, Math.min(84.5, lat));
}

export function mercatorStretch(lat: number) {
  const safeLat = Math.max(-84.5, Math.min(84.5, lat));
  return 1 / Math.cos((safeLat * Math.PI) / 180);
}

export function pixelsPerKmAt(lat: number, zoom: number) {
  const equatorial =
    (WORLD_TILE_SIZE * Math.pow(2, zoom)) / (2 * Math.PI * EARTH_RADIUS_KM);
  return equatorial * mercatorStretch(lat);
}

export function fitZoomForCountry(
  country: Country,
  lat: number,
  viewportWidth: number,
  viewportHeight: number,
) {
  const width = Math.max(1, country.bounds[2] - country.bounds[0]);
  const height = Math.max(1, country.bounds[3] - country.bounds[1]);
  const maxDimension = Math.max(width, height);
  const target = Math.min(viewportWidth, viewportHeight) * 0.46;
  const equatorialBase = WORLD_TILE_SIZE / (2 * Math.PI * EARTH_RADIUS_KM);
  const zoom = Math.log2(
    target / (maxDimension * equatorialBase * mercatorStretch(lat)),
  );
  return Math.max(2, Math.min(12.5, Number(zoom.toFixed(1))));
}

export function pickNextColor(shapes: ActiveShape[]): ShapeColor {
  const counts = new Map<string, number>();
  for (const color of SHAPE_COLORS) counts.set(color.id, 0);
  for (const shape of shapes) {
    counts.set(shape.colorId, (counts.get(shape.colorId) ?? 0) + 1);
  }
  return (
    SHAPE_COLORS.slice().sort(
      (a, b) => (counts.get(a.id) ?? 0) - (counts.get(b.id) ?? 0),
    )[0] ?? SHAPE_COLORS[0]
  );
}

export function colorForShape(shape: ActiveShape) {
  return COLOR_BY_ID.get(shape.colorId) ?? SHAPE_COLORS[0];
}

export function encodeAtlasState(payload: AtlasUrlPayload) {
  const json = JSON.stringify(payload);
  const bytes = new TextEncoder().encode(json);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

export function decodeAtlasState(value: string): AtlasUrlPayload | null {
  try {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(
      normalized.length + ((4 - (normalized.length % 4)) % 4),
      '=',
    );
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (character) =>
      character.charCodeAt(0),
    );
    const parsed = JSON.parse(new TextDecoder().decode(bytes)) as unknown;
    if (!parsed || typeof parsed !== 'object') return null;
    const payload = parsed as Partial<AtlasUrlPayload>;
    if (
      payload.v !== 1 ||
      !Array.isArray(payload.view) ||
      payload.view.length !== 3 ||
      !payload.view.every((number) => typeof number === 'number') ||
      !Array.isArray(payload.shapes)
    ) {
      return null;
    }
    return payload as AtlasUrlPayload;
  } catch {
    return null;
  }
}

export function buildShareUrl(payload: AtlasUrlPayload) {
  const url = new URL(window.location.href);
  url.searchParams.set('atlas', encodeAtlasState(payload));
  url.hash = '';
  return url.toString();
}

export function buildPayload(
  shapes: ActiveShape[],
  view: MapView,
  selectedId: string | null,
  compareOpen: boolean,
  units: Units,
): AtlasUrlPayload {
  return {
    v: 1,
    view: [
      Number(view.lat.toFixed(4)),
      Number(view.lng.toFixed(4)),
      Number(view.zoom.toFixed(2)),
    ],
    shapes: shapes.map((shape) => ({
      c: shape.countryId,
      p: [Number(shape.lat.toFixed(4)), Number(shape.lng.toFixed(4))],
      k: shape.colorId,
      r: Math.round(shape.rotation),
      ...(shape.hidden ? { h: 1 as const } : {}),
    })),
    ...(selectedId ? { selected: selectedId } : {}),
    ...(compareOpen ? { compare: 1 as const } : {}),
    ...(units === 'mi' ? { units: 'mi' as const } : {}),
  };
}

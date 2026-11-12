import fs from 'node:fs/promises';
import path from 'node:path';
import {
  geoArea,
  geoAzimuthalEqualArea,
  geoPath,
} from 'd3-geo';

const ROOT = path.resolve(import.meta.dirname, '..');
const CACHE_DIR = path.join(ROOT, '.cache');
const SOURCE_PATH = path.join(CACHE_DIR, 'ne_50m_admin_0_countries.geojson');
const OUTPUT_PATH = path.join(ROOT, 'src', 'data', 'countries.json');
const SOURCE_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';
const EARTH_RADIUS_KM = 6371.0088;

const ID_OVERRIDES = {
  'Ashmore and Cartier Islands': 'XAC',
  France: 'FRA',
  'Indian Ocean Territories': 'XIOT',
  Kosovo: 'XKX',
  'Northern Cyprus': 'XNC',
  Norway: 'NOR',
  'Siachen Glacier': 'XSG',
  Somaliland: 'XSO',
};

const ISO2_OVERRIDES = {
  France: 'FR',
  Kosovo: 'XK',
  Norway: 'NO',
  Taiwan: 'TW',
};

const NAME_OVERRIDES = {
  'Aland': 'Åland Islands',
  'Democratic Republic of the Congo': 'DR Congo',
  'East Timor': 'Timor-Leste',
  'Federated States of Micronesia': 'Micronesia',
  'Hong Kong S.A.R.': 'Hong Kong',
  'Ivory Coast': "Côte d'Ivoire",
  'Macao S.A.R': 'Macao',
  'Republic of Serbia': 'Serbia',
  'Republic of the Congo': 'Republic of the Congo',
  'Saint Barthelemy': 'Saint Barthélemy',
  'The Bahamas': 'Bahamas',
  'United Republic of Tanzania': 'Tanzania',
  'United States of America': 'United States',
  'United States Virgin Islands': 'U.S. Virgin Islands',
  Vatican: 'Vatican City',
  eSwatini: 'Eswatini',
};

const ALIASES = {
  USA: ['US', 'USA', 'United States', 'United States of America', 'America'],
  GBR: ['UK', 'United Kingdom', 'Britain', 'Great Britain'],
  ARE: ['UAE', 'United Arab Emirates'],
  COD: ['DRC', 'DR Congo', 'Democratic Republic of the Congo'],
  COG: ['Congo', 'Republic of the Congo'],
  CZE: ['Czech Republic', 'Czechia'],
  CIV: ["Côte d'Ivoire", 'Ivory Coast'],
  KOR: ['South Korea', 'Republic of Korea', 'Korea'],
  PRK: ['North Korea', "Democratic People's Republic of Korea"],
  RUS: ['Russia', 'Russian Federation'],
  VAT: ['Vatican', 'Holy See'],
  TWN: ['Taiwan', 'Chinese Taipei'],
  PSE: ['Palestine', 'Palestinian Territories'],
  XKX: ['Kosovo'],
  FRA: ['France', 'French Republic'],
  NOR: ['Norway', 'Kingdom of Norway'],
  TLS: ['Timor-Leste', 'East Timor'],
  SWZ: ['Eswatini', 'Swaziland'],
  MMR: ['Myanmar', 'Burma'],
  CPV: ['Cabo Verde', 'Cape Verde'],
  BHS: ['Bahamas', 'The Bahamas'],
  XNC: ['Northern Cyprus', 'North Cyprus'],
  XSO: ['Somaliland'],
};

function slug(value) {
  return value
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .toUpperCase();
}

function flagFromIso2(iso2) {
  if (!iso2 || !/^[A-Z]{2}$/.test(iso2)) return '◌';
  return String.fromCodePoint(
    ...[...iso2].map((character) => 127397 + character.charCodeAt(0)),
  );
}

function round(value, digits = 2) {
  return Number(value.toFixed(digits));
}

async function loadSource() {
  try {
    return JSON.parse(await fs.readFile(SOURCE_PATH, 'utf8'));
  } catch {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    console.log('Downloading Natural Earth 50m country boundaries...');
    const response = await fetch(SOURCE_URL);
    if (!response.ok) {
      throw new Error(`Natural Earth download failed: ${response.status}`);
    }
    const text = await response.text();
    await fs.writeFile(SOURCE_PATH, text);
    return JSON.parse(text);
  }
}

async function main() {
  const source = await loadSource();
  const countries = [];
  const seenIds = new Set();

  for (const feature of source.features) {
    const properties = feature.properties ?? {};
    const admin = properties.ADMIN ?? properties.NAME;
    if (!admin) continue;

    let id = ID_OVERRIDES[admin] ?? properties.ISO_A3;
    if (!id || id === '-99') id = `X${slug(admin).slice(0, 4)}`;
    let uniqueId = id;
    let duplicate = 2;
    while (seenIds.has(uniqueId)) {
      uniqueId = `${id}-${duplicate}`;
      duplicate += 1;
    }
    seenIds.add(uniqueId);

    const name = NAME_OVERRIDES[admin] ?? properties.NAME ?? admin;
    const iso2 =
      ISO2_OVERRIDES[admin] ??
      (properties.ISO_A2?.length === 2 ? properties.ISO_A2 : '');
    const labelLng = Number.isFinite(properties.LABEL_X)
      ? properties.LABEL_X
      : 0;
    const labelLat = Number.isFinite(properties.LABEL_Y)
      ? properties.LABEL_Y
      : 0;
    const area = geoArea(feature) * EARTH_RADIUS_KM * EARTH_RADIUS_KM;

    if (!Number.isFinite(area) || area <= 0) continue;

    const projection = geoAzimuthalEqualArea()
      .rotate([-labelLng, -labelLat])
      .translate([0, 0])
      .scale(EARTH_RADIUS_KM)
      .precision(0.25);

    const pathBuilder = geoPath(projection).digits(1);
    const shapePath = pathBuilder(feature);
    const bounds = pathBuilder.bounds(feature);

    if (
      !shapePath ||
      !Number.isFinite(bounds[0][0]) ||
      !Number.isFinite(bounds[1][0])
    ) {
      console.warn(`Skipping invalid geometry: ${admin}`);
      continue;
    }

    const region = properties.REGION_UN || properties.CONTINENT || 'Other';
    const aliases = Array.from(
      new Set(
        [
          name,
          admin,
          properties.NAME,
          properties.NAME_LONG,
          properties.FORMAL_EN,
          properties.SOVEREIGNT,
          properties.ISO_A3,
          iso2,
          ...(ALIASES[uniqueId] ?? []),
        ]
          .filter(Boolean)
          .map((value) => String(value)),
      ),
    );

    countries.push({
      id: uniqueId,
      name,
      officialName: properties.NAME_LONG || admin,
      iso2,
      flag: flagFromIso2(iso2),
      region,
      subregion: properties.SUBREGION || '',
      type: properties.TYPE || '',
      area: Math.round(area),
      labelLat: round(labelLat, 4),
      labelLng: round(labelLng, 4),
      aliases,
      path: shapePath,
      bounds: [
        round(bounds[0][0], 1),
        round(bounds[0][1], 1),
        round(bounds[1][0], 1),
        round(bounds[1][1], 1),
      ],
    });
  }

  countries.sort((a, b) => a.name.localeCompare(b.name));
  const payload = {
    version: 1,
    source: 'Natural Earth 1:50m Admin 0 Countries (public domain)',
    projection: 'Local azimuthal equal-area; coordinates in kilometres',
    generatedAt: new Date().toISOString(),
    countries,
  };

  await fs.mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await fs.writeFile(OUTPUT_PATH, JSON.stringify(payload));
  const stats = await fs.stat(OUTPUT_PATH);
  console.log(
    `Wrote ${countries.length} countries to ${path.relative(ROOT, OUTPUT_PATH)} (${(stats.size / 1024 / 1024).toFixed(2)} MB).`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

import rawData from './countries.json';
import type { Country, Region } from '../types';

export const COUNTRIES = rawData.countries as unknown as Country[];

export const COUNTRY_BY_ID = new Map(
  COUNTRIES.map((country) => [country.id, country]),
);

export const REGIONS: Array<Region | 'All'> = [
  'All',
  'Africa',
  'Americas',
  'Asia',
  'Europe',
  'Oceania',
];

export const FEATURED_IDS = [
  'RUS',
  'BRA',
  'AUS',
  'GRL',
  'JPN',
  'ZAF',
  'IND',
  'FRA',
];

export const FIELD_STUDIES: Array<{
  label: string;
  countryIds: [string, string];
}> = [
  { label: 'Greenland + DR Congo', countryIds: ['GRL', 'COD'] },
  { label: 'Brazil + United States', countryIds: ['BRA', 'USA'] },
  { label: 'Japan + Germany', countryIds: ['JPN', 'DEU'] },
];

export const DATA_SOURCE = rawData.source;

export type Region =
  | 'Africa'
  | 'Americas'
  | 'Asia'
  | 'Europe'
  | 'Oceania'
  | 'Antarctica';

export type Units = 'km' | 'mi';

export interface Country {
  id: string;
  name: string;
  officialName: string;
  iso2: string;
  flag: string;
  region: Region;
  subregion: string;
  type: string;
  area: number;
  labelLat: number;
  labelLng: number;
  aliases: string[];
  path: string;
  bounds: [number, number, number, number];
}

export interface ShapeColor {
  id: string;
  name: string;
  hex: string;
}

export interface ActiveShape {
  countryId: string;
  colorId: string;
  lat: number;
  lng: number;
  rotation: number;
  hidden: boolean;
}

export interface MapView {
  lat: number;
  lng: number;
  zoom: number;
}

export interface AtlasUrlShape {
  c: string;
  p: [number, number];
  k: string;
  r: number;
  h?: 1;
}

export interface AtlasUrlPayload {
  v: 1;
  view: [number, number, number];
  shapes: AtlasUrlShape[];
  selected?: string;
  compare?: 1;
  units?: Units;
}

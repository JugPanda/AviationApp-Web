export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | null;

export interface MetarData {
  icaoId: string;
  name: string;
  lat: number;
  lon: number;
  temp: number | null;
  dewp: number | null;
  wdir: number | null;
  wspd: number | null;
  wgst: number | null;
  visib: string | number;
  altim: number | null;
  fltCat: FlightCategory;
  rawOb: string;
  obsTime: number;
  clouds: {
    cover: string;
    base: number;
  }[];
}

export interface AirportSearch {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

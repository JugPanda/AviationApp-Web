export type FlightCategory = 'VFR' | 'MVFR' | 'IFR' | 'LIFR' | null;

export interface CloudLayer {
  cover: string;
  base: number;
}

export interface MetarData {
  icaoId: string;
  name?: string;
  lat: number;
  lon: number;
  temp?: number | null;
  dewp?: number | null;
  wdir?: number | null;
  wspd?: number | null;
  wgst?: number | null;
  visib?: string | number | null;
  altim?: number | null;
  fltCat?: FlightCategory;
  rawOb?: string;
  obsTime?: number;
  clouds?: CloudLayer[];
  // Extended fields for TAF
  taf?: TafData;
}

export interface TafPeriod {
  timeFrom: number;
  timeTo: number;
  changeIndicator?: string; // TEMPO, BECMG, FM, PROB
  probability?: number;
  wdir?: number | null;
  wspd?: number | null;
  wgst?: number | null;
  visib?: string | number | null;
  clouds?: CloudLayer[];
  wxString?: string;
  fltCat?: FlightCategory;
}

export interface TafData {
  icaoId: string;
  issueTime: number;
  validTimeFrom: number;
  validTimeTo: number;
  rawTAF?: string;
  periods: TafPeriod[];
}

export interface RunwayInfo {
  id: string;
  length: number;
  width: number;
  surface: string;
  lighted: boolean;
  headings: [number, number];
}

export interface FrequencyInfo {
  type: 'ATIS' | 'GND' | 'TWR' | 'APP' | 'DEP' | 'CTR' | 'CTAF' | 'UNICOM';
  name: string;
  frequency: string;
}

export interface NearbyAirport {
  icaoId: string;
  name: string;
  distance: number;
  bearing: number;
  fltCat?: FlightCategory;
}

export interface NotamData {
  id: string;
  type: 'D' | 'FDC' | 'TFR';
  effectiveStart: number;
  effectiveEnd?: number;
  text: string;
  category?: string;
  severity?: 'low' | 'medium' | 'high';
}

export interface AirportSearch {
  icao: string;
  name: string;
  lat: number;
  lon: number;
}

// Weather safety assessment
export type SafetyLevel = 'good' | 'caution' | 'marginal' | 'hazardous';

export interface WeatherCondition {
  parameter: string;
  value: string | number;
  level: SafetyLevel;
  description: string;
}

// US States with bounding boxes for geographic METAR queries
// Format: [south, west, north, east] (lat/lon)
export const US_STATES: Record<string, { name: string; bbox: [number, number, number, number] }> = {
  AL: { name: 'Alabama', bbox: [30.22, -88.47, 35.01, -84.89] },
  AK: { name: 'Alaska', bbox: [51.21, -179.15, 71.39, -129.98] },
  AZ: { name: 'Arizona', bbox: [31.33, -114.81, 37.00, -109.04] },
  AR: { name: 'Arkansas', bbox: [33.00, -94.62, 36.50, -89.64] },
  CA: { name: 'California', bbox: [32.53, -124.48, 42.01, -114.13] },
  CO: { name: 'Colorado', bbox: [36.99, -109.06, 41.00, -102.04] },
  CT: { name: 'Connecticut', bbox: [40.95, -73.73, 42.05, -71.79] },
  DE: { name: 'Delaware', bbox: [38.45, -75.79, 39.84, -75.05] },
  FL: { name: 'Florida', bbox: [24.40, -87.63, 31.00, -80.03] },
  GA: { name: 'Georgia', bbox: [30.36, -85.61, 35.00, -80.84] },
  HI: { name: 'Hawaii', bbox: [18.91, -160.25, 22.24, -154.81] },
  ID: { name: 'Idaho', bbox: [41.99, -117.24, 49.00, -111.04] },
  IL: { name: 'Illinois', bbox: [36.97, -91.51, 42.51, -87.02] },
  IN: { name: 'Indiana', bbox: [37.77, -88.10, 41.76, -84.78] },
  IA: { name: 'Iowa', bbox: [40.38, -96.64, 43.50, -90.14] },
  KS: { name: 'Kansas', bbox: [36.99, -102.05, 40.00, -94.59] },
  KY: { name: 'Kentucky', bbox: [36.50, -89.57, 39.15, -81.96] },
  LA: { name: 'Louisiana', bbox: [28.93, -94.04, 33.02, -88.82] },
  ME: { name: 'Maine', bbox: [43.06, -71.08, 47.46, -66.95] },
  MD: { name: 'Maryland', bbox: [37.91, -79.49, 39.72, -75.05] },
  MA: { name: 'Massachusetts', bbox: [41.24, -73.50, 42.89, -69.93] },
  MI: { name: 'Michigan', bbox: [41.70, -90.42, 48.19, -82.41] },
  MN: { name: 'Minnesota', bbox: [43.50, -97.24, 49.38, -89.49] },
  MS: { name: 'Mississippi', bbox: [30.17, -91.66, 35.00, -88.10] },
  MO: { name: 'Missouri', bbox: [35.99, -95.77, 40.61, -89.10] },
  MT: { name: 'Montana', bbox: [44.36, -116.05, 49.00, -104.04] },
  NE: { name: 'Nebraska', bbox: [40.00, -104.05, 43.00, -95.31] },
  NV: { name: 'Nevada', bbox: [35.00, -120.01, 42.00, -114.04] },
  NH: { name: 'New Hampshire', bbox: [42.70, -72.56, 45.31, -70.70] },
  NJ: { name: 'New Jersey', bbox: [38.93, -75.56, 41.36, -73.89] },
  NM: { name: 'New Mexico', bbox: [31.33, -109.05, 37.00, -103.00] },
  NY: { name: 'New York', bbox: [40.50, -79.76, 45.02, -71.86] },
  NC: { name: 'North Carolina', bbox: [33.84, -84.32, 36.59, -75.46] },
  ND: { name: 'North Dakota', bbox: [45.94, -104.05, 49.00, -96.55] },
  OH: { name: 'Ohio', bbox: [38.40, -84.82, 42.00, -80.52] },
  OK: { name: 'Oklahoma', bbox: [33.62, -103.00, 37.00, -94.43] },
  OR: { name: 'Oregon', bbox: [41.99, -124.57, 46.29, -116.46] },
  PA: { name: 'Pennsylvania', bbox: [39.72, -80.52, 42.27, -74.69] },
  RI: { name: 'Rhode Island', bbox: [41.15, -71.86, 42.02, -71.12] },
  SC: { name: 'South Carolina', bbox: [32.03, -83.35, 35.22, -78.54] },
  SD: { name: 'South Dakota', bbox: [42.48, -104.06, 45.95, -96.44] },
  TN: { name: 'Tennessee', bbox: [34.98, -90.31, 36.68, -81.65] },
  TX: { name: 'Texas', bbox: [25.84, -106.65, 36.50, -93.51] },
  UT: { name: 'Utah', bbox: [36.99, -114.05, 42.00, -109.04] },
  VT: { name: 'Vermont', bbox: [42.73, -73.44, 45.02, -71.46] },
  VA: { name: 'Virginia', bbox: [36.54, -83.68, 39.47, -75.24] },
  WA: { name: 'Washington', bbox: [45.54, -124.85, 49.00, -116.92] },
  WV: { name: 'West Virginia', bbox: [37.20, -82.64, 40.64, -77.72] },
  WI: { name: 'Wisconsin', bbox: [42.49, -92.89, 47.08, -86.25] },
  WY: { name: 'Wyoming', bbox: [40.99, -111.06, 45.01, -104.05] },
};

// Regions with combined bounding boxes
export const US_REGIONS: Record<string, { name: string; states: string[]; bbox: [number, number, number, number] }> = {
  northeast: {
    name: 'Northeast',
    states: ['CT', 'DE', 'MA', 'MD', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
    bbox: [38.45, -80.52, 47.46, -66.95], // Combined bbox
  },
  southeast: {
    name: 'Southeast', 
    states: ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
    bbox: [24.40, -91.66, 39.47, -75.24],
  },
  midwest: {
    name: 'Midwest',
    states: ['IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI'],
    bbox: [35.99, -104.06, 49.38, -80.52],
  },
  southwest: {
    name: 'Southwest',
    states: ['AZ', 'NM', 'OK', 'TX'],
    bbox: [25.84, -114.81, 37.00, -93.51],
  },
  west: {
    name: 'West',
    states: ['CA', 'CO', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
    bbox: [32.53, -124.85, 49.00, -102.04],
  },
  alaska: {
    name: 'Alaska',
    states: ['AK'],
    bbox: [51.21, -179.15, 71.39, -129.98],
  },
  hawaii: {
    name: 'Hawaii',
    states: ['HI'],
    bbox: [18.91, -160.25, 22.24, -154.81],
  },
};

// Popular airports for default view (fast initial load)
export const DEFAULT_AIRPORTS = [
  'KJFK', 'KLAX', 'KORD', 'KATL', 'KDFW', 
  'KDEN', 'KSFO', 'KLAS', 'KMIA', 'KSEA',
  'KBOS', 'KMSP', 'KDTW', 'KPHL', 'KPHX',
  'KIAH', 'KMCO', 'KEWR', 'KSLC', 'KSAN'
];

// Convert bbox to AWC API format: "minLat,minLon,maxLat,maxLon"
export function bboxToString(bbox: [number, number, number, number]): string {
  return `${bbox[0]},${bbox[1]},${bbox[2]},${bbox[3]}`;
}

// Combine multiple state bboxes into one
export function combineStateBboxes(stateCodes: string[]): [number, number, number, number] | null {
  if (stateCodes.length === 0) return null;
  
  let minLat = 90, minLon = 180, maxLat = -90, maxLon = -180;
  
  for (const code of stateCodes) {
    const state = US_STATES[code];
    if (state) {
      minLat = Math.min(minLat, state.bbox[0]);
      minLon = Math.min(minLon, state.bbox[1]);
      maxLat = Math.max(maxLat, state.bbox[2]);
      maxLon = Math.max(maxLon, state.bbox[3]);
    }
  }
  
  return [minLat, minLon, maxLat, maxLon];
}

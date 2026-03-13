import { NextRequest, NextResponse } from 'next/server';

export interface AirspaceData {
  id: string;
  name: string;
  type: 'B' | 'C' | 'D' | 'E' | 'MOA' | 'RESTRICTED' | 'PROHIBITED';
  floor: number; // feet AGL or MSL
  ceiling: number;
  floorType: 'AGL' | 'MSL';
  ceilingType: 'AGL' | 'MSL';
  center: { lat: number; lng: number };
  rings: AirspaceRing[];
}

export interface AirspaceRing {
  floor: number;
  ceiling: number;
  radius: number; // nm
  points?: { lat: number; lng: number }[]; // for irregular shapes
}

// Major US Class B airspaces with simplified rings
const CLASS_B_AIRSPACES: AirspaceData[] = [
  {
    id: 'B-ATL', name: 'Atlanta Class B', type: 'B',
    floor: 0, ceiling: 12500, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 33.6407, lng: -84.4277 },
    rings: [
      { floor: 0, ceiling: 12500, radius: 10 },
      { floor: 3000, ceiling: 12500, radius: 15 },
      { floor: 6000, ceiling: 12500, radius: 20 },
      { floor: 8000, ceiling: 12500, radius: 30 },
    ]
  },
  {
    id: 'B-BOS', name: 'Boston Class B', type: 'B',
    floor: 0, ceiling: 7000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 42.3656, lng: -71.0096 },
    rings: [
      { floor: 0, ceiling: 7000, radius: 7 },
      { floor: 2000, ceiling: 7000, radius: 10 },
      { floor: 3000, ceiling: 7000, radius: 15 },
      { floor: 4000, ceiling: 7000, radius: 20 },
    ]
  },
  {
    id: 'B-ORD', name: 'Chicago Class B', type: 'B',
    floor: 0, ceiling: 10000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 41.9742, lng: -87.9073 },
    rings: [
      { floor: 0, ceiling: 10000, radius: 10 },
      { floor: 1900, ceiling: 10000, radius: 15 },
      { floor: 3000, ceiling: 10000, radius: 20 },
      { floor: 5000, ceiling: 10000, radius: 30 },
    ]
  },
  {
    id: 'B-DFW', name: 'Dallas/Fort Worth Class B', type: 'B',
    floor: 0, ceiling: 11000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 32.8998, lng: -97.0403 },
    rings: [
      { floor: 0, ceiling: 11000, radius: 10 },
      { floor: 3000, ceiling: 11000, radius: 15 },
      { floor: 5000, ceiling: 11000, radius: 20 },
      { floor: 6000, ceiling: 11000, radius: 30 },
    ]
  },
  {
    id: 'B-DEN', name: 'Denver Class B', type: 'B',
    floor: 0, ceiling: 12000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 39.8561, lng: -104.6737 },
    rings: [
      { floor: 5500, ceiling: 12000, radius: 8 },
      { floor: 7000, ceiling: 12000, radius: 12 },
      { floor: 8000, ceiling: 12000, radius: 15 },
      { floor: 9000, ceiling: 12000, radius: 20 },
    ]
  },
  {
    id: 'B-DTW', name: 'Detroit Class B', type: 'B',
    floor: 0, ceiling: 8000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 42.2124, lng: -83.3534 },
    rings: [
      { floor: 0, ceiling: 8000, radius: 8 },
      { floor: 2000, ceiling: 8000, radius: 12 },
      { floor: 3000, ceiling: 8000, radius: 15 },
      { floor: 4000, ceiling: 8000, radius: 20 },
    ]
  },
  {
    id: 'B-IAH', name: 'Houston Class B', type: 'B',
    floor: 0, ceiling: 10000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 29.9902, lng: -95.3368 },
    rings: [
      { floor: 0, ceiling: 10000, radius: 10 },
      { floor: 2000, ceiling: 10000, radius: 15 },
      { floor: 4000, ceiling: 10000, radius: 20 },
      { floor: 6000, ceiling: 10000, radius: 30 },
    ]
  },
  {
    id: 'B-JFK', name: 'New York Class B', type: 'B',
    floor: 0, ceiling: 7000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 40.6413, lng: -73.7781 },
    rings: [
      { floor: 0, ceiling: 7000, radius: 7 },
      { floor: 1500, ceiling: 7000, radius: 10 },
      { floor: 2000, ceiling: 7000, radius: 15 },
      { floor: 3000, ceiling: 7000, radius: 20 },
      { floor: 4000, ceiling: 7000, radius: 30 },
    ]
  },
  {
    id: 'B-LAX', name: 'Los Angeles Class B', type: 'B',
    floor: 0, ceiling: 10000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 33.9425, lng: -118.4081 },
    rings: [
      { floor: 0, ceiling: 10000, radius: 5 },
      { floor: 2500, ceiling: 10000, radius: 10 },
      { floor: 4000, ceiling: 10000, radius: 15 },
      { floor: 6000, ceiling: 10000, radius: 20 },
      { floor: 8000, ceiling: 10000, radius: 25 },
    ]
  },
  {
    id: 'B-LAS', name: 'Las Vegas Class B', type: 'B',
    floor: 0, ceiling: 10000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 36.0840, lng: -115.1537 },
    rings: [
      { floor: 0, ceiling: 10000, radius: 8 },
      { floor: 3000, ceiling: 10000, radius: 12 },
      { floor: 5000, ceiling: 10000, radius: 18 },
      { floor: 7000, ceiling: 10000, radius: 25 },
    ]
  },
  {
    id: 'B-MIA', name: 'Miami Class B', type: 'B',
    floor: 0, ceiling: 7000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 25.7959, lng: -80.2870 },
    rings: [
      { floor: 0, ceiling: 7000, radius: 7 },
      { floor: 1500, ceiling: 7000, radius: 10 },
      { floor: 2000, ceiling: 7000, radius: 15 },
      { floor: 4000, ceiling: 7000, radius: 20 },
    ]
  },
  {
    id: 'B-MSP', name: 'Minneapolis Class B', type: 'B',
    floor: 0, ceiling: 8000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 44.8848, lng: -93.2223 },
    rings: [
      { floor: 0, ceiling: 8000, radius: 8 },
      { floor: 2000, ceiling: 8000, radius: 12 },
      { floor: 3000, ceiling: 8000, radius: 15 },
      { floor: 5000, ceiling: 8000, radius: 20 },
    ]
  },
  {
    id: 'B-EWR', name: 'Newark Class B', type: 'B',
    floor: 0, ceiling: 7000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 40.6895, lng: -74.1745 },
    rings: [
      { floor: 0, ceiling: 7000, radius: 7 },
      { floor: 1500, ceiling: 7000, radius: 10 },
      { floor: 2500, ceiling: 7000, radius: 15 },
    ]
  },
  {
    id: 'B-MCO', name: 'Orlando Class B', type: 'B',
    floor: 0, ceiling: 10000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 28.4312, lng: -81.3081 },
    rings: [
      { floor: 0, ceiling: 10000, radius: 10 },
      { floor: 2000, ceiling: 10000, radius: 15 },
      { floor: 4000, ceiling: 10000, radius: 20 },
      { floor: 6000, ceiling: 10000, radius: 30 },
    ]
  },
  {
    id: 'B-PHL', name: 'Philadelphia Class B', type: 'B',
    floor: 0, ceiling: 7000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 39.8721, lng: -75.2411 },
    rings: [
      { floor: 0, ceiling: 7000, radius: 7 },
      { floor: 1500, ceiling: 7000, radius: 10 },
      { floor: 2500, ceiling: 7000, radius: 15 },
      { floor: 4000, ceiling: 7000, radius: 20 },
    ]
  },
  {
    id: 'B-PHX', name: 'Phoenix Class B', type: 'B',
    floor: 0, ceiling: 9000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 33.4373, lng: -112.0078 },
    rings: [
      { floor: 0, ceiling: 9000, radius: 10 },
      { floor: 3000, ceiling: 9000, radius: 15 },
      { floor: 5000, ceiling: 9000, radius: 20 },
      { floor: 6000, ceiling: 9000, radius: 25 },
    ]
  },
  {
    id: 'B-SFO', name: 'San Francisco Class B', type: 'B',
    floor: 0, ceiling: 8000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 37.6213, lng: -122.3790 },
    rings: [
      { floor: 0, ceiling: 8000, radius: 7 },
      { floor: 1500, ceiling: 8000, radius: 10 },
      { floor: 3000, ceiling: 8000, radius: 15 },
      { floor: 4000, ceiling: 8000, radius: 20 },
    ]
  },
  {
    id: 'B-SEA', name: 'Seattle Class B', type: 'B',
    floor: 0, ceiling: 10000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 47.4502, lng: -122.3088 },
    rings: [
      { floor: 0, ceiling: 10000, radius: 7 },
      { floor: 2000, ceiling: 10000, radius: 10 },
      { floor: 3000, ceiling: 10000, radius: 15 },
      { floor: 5000, ceiling: 10000, radius: 20 },
    ]
  },
  {
    id: 'B-STL', name: 'St. Louis Class B', type: 'B',
    floor: 0, ceiling: 8000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 38.7487, lng: -90.3700 },
    rings: [
      { floor: 0, ceiling: 8000, radius: 8 },
      { floor: 2000, ceiling: 8000, radius: 12 },
      { floor: 3000, ceiling: 8000, radius: 15 },
      { floor: 5000, ceiling: 8000, radius: 20 },
    ]
  },
  {
    id: 'B-DCA', name: 'Washington DC Class B', type: 'B',
    floor: 0, ceiling: 10000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 38.8512, lng: -77.0402 },
    rings: [
      { floor: 0, ceiling: 10000, radius: 7 },
      { floor: 1500, ceiling: 10000, radius: 10 },
      { floor: 2500, ceiling: 10000, radius: 15 },
      { floor: 4000, ceiling: 10000, radius: 18 },
    ]
  },
  {
    id: 'B-CLT', name: 'Charlotte Class B', type: 'B',
    floor: 0, ceiling: 10000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 35.2140, lng: -80.9431 },
    rings: [
      { floor: 0, ceiling: 10000, radius: 10 },
      { floor: 2500, ceiling: 10000, radius: 15 },
      { floor: 4000, ceiling: 10000, radius: 20 },
      { floor: 6000, ceiling: 10000, radius: 25 },
    ]
  },
  {
    id: 'B-SDF', name: 'Louisville Class B', type: 'B',
    floor: 0, ceiling: 8000, floorType: 'MSL', ceilingType: 'MSL',
    center: { lat: 38.1744, lng: -85.7360 },
    rings: [
      { floor: 0, ceiling: 8000, radius: 8 },
      { floor: 2000, ceiling: 8000, radius: 12 },
      { floor: 3500, ceiling: 8000, radius: 15 },
      { floor: 5000, ceiling: 8000, radius: 20 },
    ]
  },
];

// Sample Class C airports (simplified circles)
const CLASS_C_AIRSPACES: AirspaceData[] = [
  // Major Class C airports
  ...[
    { id: 'ABQ', name: 'Albuquerque', lat: 35.0402, lng: -106.6090 },
    { id: 'AUS', name: 'Austin', lat: 30.1945, lng: -97.6699 },
    { id: 'BDL', name: 'Hartford', lat: 41.9389, lng: -72.6832 },
    { id: 'BHM', name: 'Birmingham', lat: 33.5629, lng: -86.7535 },
    { id: 'BNA', name: 'Nashville', lat: 36.1245, lng: -86.6782 },
    { id: 'BUF', name: 'Buffalo', lat: 42.9405, lng: -78.7322 },
    { id: 'BWI', name: 'Baltimore', lat: 39.1754, lng: -76.6684 },
    { id: 'CHS', name: 'Charleston SC', lat: 32.8986, lng: -80.0405 },
    { id: 'CLE', name: 'Cleveland', lat: 41.4117, lng: -81.8498 },
    { id: 'CMH', name: 'Columbus OH', lat: 39.9980, lng: -82.8919 },
    { id: 'CVG', name: 'Cincinnati', lat: 39.0488, lng: -84.6678 },
    { id: 'DAL', name: 'Dallas Love', lat: 32.8471, lng: -96.8518 },
    { id: 'DAY', name: 'Dayton', lat: 39.9024, lng: -84.2194 },
    { id: 'DSM', name: 'Des Moines', lat: 41.5340, lng: -93.6631 },
    { id: 'ELP', name: 'El Paso', lat: 31.8072, lng: -106.3775 },
    { id: 'FLL', name: 'Fort Lauderdale', lat: 26.0726, lng: -80.1527 },
    { id: 'GRR', name: 'Grand Rapids', lat: 42.8808, lng: -85.5228 },
    { id: 'GSO', name: 'Greensboro', lat: 36.0978, lng: -79.9373 },
    { id: 'GSP', name: 'Greenville SC', lat: 34.8957, lng: -82.2189 },
    { id: 'HNL', name: 'Honolulu', lat: 21.3187, lng: -157.9225 },
    { id: 'IND', name: 'Indianapolis', lat: 39.7173, lng: -86.2944 },
    { id: 'JAX', name: 'Jacksonville', lat: 30.4941, lng: -81.6879 },
    { id: 'MCI', name: 'Kansas City', lat: 39.2976, lng: -94.7139 },
    { id: 'MEM', name: 'Memphis', lat: 35.0424, lng: -89.9767 },
    { id: 'MKE', name: 'Milwaukee', lat: 42.9472, lng: -87.8966 },
    { id: 'MSY', name: 'New Orleans', lat: 29.9934, lng: -90.2580 },
    { id: 'OAK', name: 'Oakland', lat: 37.7213, lng: -122.2208 },
    { id: 'OKC', name: 'Oklahoma City', lat: 35.3931, lng: -97.6007 },
    { id: 'OMA', name: 'Omaha', lat: 41.3032, lng: -95.8941 },
    { id: 'ONT', name: 'Ontario CA', lat: 34.0560, lng: -117.6012 },
    { id: 'PBI', name: 'West Palm Beach', lat: 26.6832, lng: -80.0956 },
    { id: 'PDX', name: 'Portland', lat: 45.5898, lng: -122.5951 },
    { id: 'PIT', name: 'Pittsburgh', lat: 40.4915, lng: -80.2329 },
    { id: 'PVD', name: 'Providence', lat: 41.7326, lng: -71.4204 },
    { id: 'RDU', name: 'Raleigh-Durham', lat: 35.8776, lng: -78.7875 },
    { id: 'RIC', name: 'Richmond', lat: 37.5052, lng: -77.3197 },
    { id: 'RSW', name: 'Fort Myers', lat: 26.5362, lng: -81.7552 },
    { id: 'SAN', name: 'San Diego', lat: 32.7336, lng: -117.1897 },
    { id: 'SAT', name: 'San Antonio', lat: 29.5337, lng: -98.4698 },
    { id: 'SJC', name: 'San Jose', lat: 37.3626, lng: -121.9290 },
    { id: 'SLC', name: 'Salt Lake City', lat: 40.7884, lng: -111.9778 },
    { id: 'SMF', name: 'Sacramento', lat: 38.6954, lng: -121.5908 },
    { id: 'SRQ', name: 'Sarasota', lat: 27.3954, lng: -82.5544 },
    { id: 'SYR', name: 'Syracuse', lat: 43.1112, lng: -76.1063 },
    { id: 'TPA', name: 'Tampa', lat: 27.9755, lng: -82.5332 },
    { id: 'TUL', name: 'Tulsa', lat: 36.1984, lng: -95.8881 },
    { id: 'TUS', name: 'Tucson', lat: 32.1161, lng: -110.9410 },
  ].map(apt => ({
    id: `C-${apt.id}`,
    name: `${apt.name} Class C`,
    type: 'C' as const,
    floor: 0,
    ceiling: 4000,
    floorType: 'AGL' as const,
    ceilingType: 'AGL' as const,
    center: { lat: apt.lat, lng: apt.lng },
    rings: [
      { floor: 0, ceiling: 4000, radius: 5 },
      { floor: 1200, ceiling: 4000, radius: 10 },
    ]
  }))
];

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const types = searchParams.get('types')?.split(',') || ['B', 'C'];
  const bounds = searchParams.get('bounds');
  
  let airspaces: AirspaceData[] = [];
  
  if (types.includes('B')) {
    airspaces = [...airspaces, ...CLASS_B_AIRSPACES];
  }
  if (types.includes('C')) {
    airspaces = [...airspaces, ...CLASS_C_AIRSPACES];
  }
  
  // Filter by map bounds if provided
  if (bounds) {
    const [south, north, west, east] = bounds.split(',').map(Number);
    airspaces = airspaces.filter(a => {
      const { lat, lng } = a.center;
      return lat >= south - 1 && lat <= north + 1 && lng >= west - 1 && lng <= east + 1;
    });
  }
  
  return NextResponse.json(airspaces);
}

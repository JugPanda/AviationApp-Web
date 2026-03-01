// US States with major airports and bounding boxes for filtering
export const US_STATES: Record<string, { name: string; airports: string[]; bbox?: [number, number, number, number] }> = {
  AL: { name: 'Alabama', airports: ['KBHM', 'KMOB', 'KHSV', 'KMGM'] },
  AK: { name: 'Alaska', airports: ['PANC', 'PAFA', 'PAJN', 'PAKN'] },
  AZ: { name: 'Arizona', airports: ['KPHX', 'KTUS', 'KSDL', 'KFLG', 'KGYR'] },
  AR: { name: 'Arkansas', airports: ['KLIT', 'KXNA', 'KFSM', 'KTXK'] },
  CA: { name: 'California', airports: ['KLAX', 'KSFO', 'KSAN', 'KOAK', 'KSJC', 'KONT', 'KBUR', 'KSNA', 'KSMF', 'KFAT'] },
  CO: { name: 'Colorado', airports: ['KDEN', 'KCOS', 'KASE', 'KEGE', 'KPUB'] },
  CT: { name: 'Connecticut', airports: ['KBDL', 'KHVN', 'KOXC'] },
  DE: { name: 'Delaware', airports: ['KILG', 'KDOV'] },
  FL: { name: 'Florida', airports: ['KMIA', 'KMCO', 'KTPA', 'KFLL', 'KJAX', 'KPBI', 'KRSW', 'KSRQ', 'KEYW'] },
  GA: { name: 'Georgia', airports: ['KATL', 'KSAV', 'KAGS', 'KCSG'] },
  HI: { name: 'Hawaii', airports: ['PHNL', 'PHOG', 'PHKO', 'PHLI'] },
  ID: { name: 'Idaho', airports: ['KBOI', 'KSUN', 'KIDA'] },
  IL: { name: 'Illinois', airports: ['KORD', 'KMDW', 'KSPI', 'KPIA', 'KMLI'] },
  IN: { name: 'Indiana', airports: ['KIND', 'KFWA', 'KEVV', 'KSBN'] },
  IA: { name: 'Iowa', airports: ['KDSM', 'KCID', 'KMLI'] },
  KS: { name: 'Kansas', airports: ['KICT', 'KMCI', 'KMHK'] },
  KY: { name: 'Kentucky', airports: ['KSDF', 'KCVG', 'KLEX'] },
  LA: { name: 'Louisiana', airports: ['KMSY', 'KBTR', 'KSHV', 'KLFT'] },
  ME: { name: 'Maine', airports: ['KPWM', 'KBGR', 'KRKD'] },
  MD: { name: 'Maryland', airports: ['KBWI', 'KADW'] },
  MA: { name: 'Massachusetts', airports: ['KBOS', 'KBED', 'KORH', 'KACK'] },
  MI: { name: 'Michigan', airports: ['KDTW', 'KGRR', 'KFNT', 'KLAN', 'KTVC'] },
  MN: { name: 'Minnesota', airports: ['KMSP', 'KRST', 'KDLH'] },
  MS: { name: 'Mississippi', airports: ['KJAN', 'KGPT', 'KMEI'] },
  MO: { name: 'Missouri', airports: ['KMCI', 'KSTL', 'KSGF', 'KCOU'] },
  MT: { name: 'Montana', airports: ['KBIL', 'KBZN', 'KGPI', 'KMSO'] },
  NE: { name: 'Nebraska', airports: ['KOMA', 'KLNK'] },
  NV: { name: 'Nevada', airports: ['KLAS', 'KRNO', 'KVGT'] },
  NH: { name: 'New Hampshire', airports: ['KMHT', 'KPSM'] },
  NJ: { name: 'New Jersey', airports: ['KEWR', 'KTTN', 'KACY'] },
  NM: { name: 'New Mexico', airports: ['KABQ', 'KSAF', 'KROW'] },
  NY: { name: 'New York', airports: ['KJFK', 'KLGA', 'KBUF', 'KSYR', 'KROC', 'KALB', 'KISP', 'KSWF'] },
  NC: { name: 'North Carolina', airports: ['KCLT', 'KRDU', 'KGSO', 'KFAY', 'KAVL'] },
  ND: { name: 'North Dakota', airports: ['KFAR', 'KBIS', 'KGFK'] },
  OH: { name: 'Ohio', airports: ['KCLE', 'KCMH', 'KCVG', 'KDAY', 'KTOL', 'KCAK'] },
  OK: { name: 'Oklahoma', airports: ['KOKC', 'KTUL', 'KLAW'] },
  OR: { name: 'Oregon', airports: ['KPDX', 'KEUG', 'KMFR', 'KRDM'] },
  PA: { name: 'Pennsylvania', airports: ['KPHL', 'KPIT', 'KABE', 'KMDT', 'KERI'] },
  RI: { name: 'Rhode Island', airports: ['KPVD'] },
  SC: { name: 'South Carolina', airports: ['KCHS', 'KCAE', 'KGSP', 'KMYR'] },
  SD: { name: 'South Dakota', airports: ['KFSD', 'KRAP'] },
  TN: { name: 'Tennessee', airports: ['KBNA', 'KMEM', 'KTYS', 'KCHA'] },
  TX: { name: 'Texas', airports: ['KDFW', 'KIAH', 'KAUS', 'KSAT', 'KHOU', 'KELP', 'KAMA', 'KLBB', 'KMAF', 'KHRL', 'KCORP'] },
  UT: { name: 'Utah', airports: ['KSLC', 'KPVU', 'KSGC'] },
  VT: { name: 'Vermont', airports: ['KBTV'] },
  VA: { name: 'Virginia', airports: ['KIAD', 'KDCA', 'KRIC', 'KORF', 'KPHF', 'KCHO'] },
  WA: { name: 'Washington', airports: ['KSEA', 'KGEG', 'KPSC', 'KBLI'] },
  WV: { name: 'West Virginia', airports: ['KCRW', 'KMGW'] },
  WI: { name: 'Wisconsin', airports: ['KMKE', 'KMSN', 'KGRB', 'KATW'] },
  WY: { name: 'Wyoming', airports: ['KCYS', 'KJAC', 'KCOD'] },
};

// Get all airports for selected states
export function getAirportsForStates(stateCodes: string[]): string[] {
  if (stateCodes.length === 0) {
    // Return all US airports
    return Object.values(US_STATES).flatMap(s => s.airports);
  }
  return stateCodes.flatMap(code => US_STATES[code]?.airports || []);
}

// Popular airports across the US for default view
export const DEFAULT_AIRPORTS = [
  'KJFK', 'KLAX', 'KORD', 'KATL', 'KDFW', 
  'KDEN', 'KSFO', 'KLAS', 'KMIA', 'KSEA',
  'KBOS', 'KMSP', 'KDTW', 'KPHL', 'KPHX',
  'KIAH', 'KMCO', 'KEWR', 'KSLC', 'KSAN'
];

// Regions for broader filtering
export const US_REGIONS: Record<string, { name: string; states: string[] }> = {
  northeast: {
    name: 'Northeast',
    states: ['CT', 'DE', 'MA', 'MD', 'ME', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  },
  southeast: {
    name: 'Southeast',
    states: ['AL', 'FL', 'GA', 'KY', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'],
  },
  midwest: {
    name: 'Midwest',
    states: ['IA', 'IL', 'IN', 'KS', 'MI', 'MN', 'MO', 'ND', 'NE', 'OH', 'SD', 'WI'],
  },
  southwest: {
    name: 'Southwest',
    states: ['AZ', 'NM', 'OK', 'TX'],
  },
  west: {
    name: 'West',
    states: ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'],
  },
};

// Aircraft Profile Management for Weight & Balance

export interface CustomAircraft {
  name: string;
  emptyWeight: number;
  emptyArm: number;
  maxGross: number;
  fuelArm: number;
  fuelCapacity: number;
  fuelWeight: number;
  stations: {
    name: string;
    arm: number;
    maxWeight?: number;
  }[];
  envelope: {
    points: { weight: number; cgMin: number; cgMax: number }[];
  };
}

export interface AircraftProfile {
  id: string;
  name: string;
  aircraftType: string; // 'C172S', 'C182T', 'PA28-181', or 'custom'
  customAircraft?: CustomAircraft;
  fuelGallons: number;
  stationWeights: number[];
  createdAt: number;
  updatedAt: number;
}

const STORAGE_KEY = 'avweather-profiles';
const MAX_PROFILES = 20;

// Generate unique ID
export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

// Get all profiles from localStorage
export function getProfiles(): AircraftProfile[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save profiles to localStorage
function saveProfiles(profiles: AircraftProfile[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(profiles));
}

// Create a new profile
export function createProfile(profile: Omit<AircraftProfile, 'id' | 'createdAt' | 'updatedAt'>): AircraftProfile | null {
  const profiles = getProfiles();
  
  if (profiles.length >= MAX_PROFILES) {
    return null; // Max profiles reached
  }
  
  const newProfile: AircraftProfile = {
    ...profile,
    id: generateId(),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  
  profiles.push(newProfile);
  saveProfiles(profiles);
  return newProfile;
}

// Update an existing profile
export function updateProfile(id: string, updates: Partial<Omit<AircraftProfile, 'id' | 'createdAt'>>): AircraftProfile | null {
  const profiles = getProfiles();
  const index = profiles.findIndex(p => p.id === id);
  
  if (index === -1) return null;
  
  profiles[index] = {
    ...profiles[index],
    ...updates,
    updatedAt: Date.now(),
  };
  
  saveProfiles(profiles);
  return profiles[index];
}

// Delete a profile
export function deleteProfile(id: string): boolean {
  const profiles = getProfiles();
  const filtered = profiles.filter(p => p.id !== id);
  
  if (filtered.length === profiles.length) return false;
  
  saveProfiles(filtered);
  return true;
}

// Get a single profile by ID
export function getProfile(id: string): AircraftProfile | null {
  const profiles = getProfiles();
  return profiles.find(p => p.id === id) || null;
}

// Export profiles as JSON string
export function exportProfiles(): string {
  const profiles = getProfiles();
  return JSON.stringify(profiles, null, 2);
}

// Import profiles from JSON string
export function importProfiles(jsonString: string): { success: boolean; imported: number; error?: string } {
  try {
    const imported = JSON.parse(jsonString) as AircraftProfile[];
    
    if (!Array.isArray(imported)) {
      return { success: false, imported: 0, error: 'Invalid format: expected an array' };
    }
    
    const existing = getProfiles();
    const existingIds = new Set(existing.map(p => p.id));
    
    // Filter out duplicates and validate structure
    const newProfiles: AircraftProfile[] = [];
    for (const profile of imported) {
      if (!profile.id || !profile.name || !profile.aircraftType) {
        continue; // Skip invalid profiles
      }
      if (existingIds.has(profile.id)) {
        // Generate new ID for duplicates
        profile.id = generateId();
      }
      newProfiles.push(profile);
    }
    
    // Check max limit
    const totalAfterImport = existing.length + newProfiles.length;
    if (totalAfterImport > MAX_PROFILES) {
      const canImport = MAX_PROFILES - existing.length;
      newProfiles.splice(canImport);
    }
    
    saveProfiles([...existing, ...newProfiles]);
    return { success: true, imported: newProfiles.length };
  } catch (e) {
    return { success: false, imported: 0, error: 'Invalid JSON format' };
  }
}

// Get custom aircraft storage key
const CUSTOM_AIRCRAFT_KEY = 'avweather-custom-aircraft';

// Get all custom aircraft
export function getCustomAircraft(): CustomAircraft[] {
  if (typeof window === 'undefined') return [];
  try {
    const data = localStorage.getItem(CUSTOM_AIRCRAFT_KEY);
    return data ? JSON.parse(data) : [];
  } catch {
    return [];
  }
}

// Save a custom aircraft
export function saveCustomAircraft(aircraft: CustomAircraft): void {
  const existing = getCustomAircraft();
  const index = existing.findIndex(a => a.name === aircraft.name);
  
  if (index >= 0) {
    existing[index] = aircraft;
  } else {
    existing.push(aircraft);
  }
  
  localStorage.setItem(CUSTOM_AIRCRAFT_KEY, JSON.stringify(existing));
}

// Delete a custom aircraft
export function deleteCustomAircraft(name: string): boolean {
  const existing = getCustomAircraft();
  const filtered = existing.filter(a => a.name !== name);
  
  if (filtered.length === existing.length) return false;
  
  localStorage.setItem(CUSTOM_AIRCRAFT_KEY, JSON.stringify(filtered));
  return true;
}

'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  AircraftProfile,
  CustomAircraft,
  getProfiles,
  createProfile,
  updateProfile,
  deleteProfile,
  getCustomAircraft,
  saveCustomAircraft,
  deleteCustomAircraft,
  exportProfiles,
  importProfiles,
} from '@/lib/profiles';

// Aircraft weight & balance data
interface Station {
  name: string;
  arm: number; // inches from datum
  minWeight?: number;
  maxWeight?: number;
  defaultWeight?: number;
}

interface CGEnvelope {
  points: { weight: number; cgMin: number; cgMax: number }[];
}

interface AircraftData {
  name: string;
  emptyWeight: number;
  emptyArm: number;
  maxGross: number;
  fuelArm: number;
  fuelCapacity: number; // gallons
  fuelWeight: number; // lbs per gallon
  stations: Station[];
  envelope: CGEnvelope;
}

const AIRCRAFT_DATABASE: Record<string, AircraftData> = {
  'C172S': {
    name: 'Cessna 172S Skyhawk SP',
    emptyWeight: 1680,
    emptyArm: 39.0,
    maxGross: 2550,
    fuelArm: 48.0,
    fuelCapacity: 53,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 73.0, maxWeight: 400 },
      { name: 'Baggage Area 1', arm: 95.0, maxWeight: 120 },
      { name: 'Baggage Area 2', arm: 123.0, maxWeight: 50 },
    ],
    envelope: {
      points: [
        { weight: 1500, cgMin: 35.0, cgMax: 47.3 },
        { weight: 1950, cgMin: 35.0, cgMax: 47.3 },
        { weight: 2550, cgMin: 41.0, cgMax: 47.3 },
      ]
    }
  },
  'C182T': {
    name: 'Cessna 182T Skylane',
    emptyWeight: 1970,
    emptyArm: 39.5,
    maxGross: 3100,
    fuelArm: 46.0,
    fuelCapacity: 87,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 74.0, maxWeight: 400 },
      { name: 'Baggage Area 1', arm: 97.0, maxWeight: 200 },
      { name: 'Baggage Area 2', arm: 120.0, maxWeight: 50 },
    ],
    envelope: {
      points: [
        { weight: 1800, cgMin: 35.0, cgMax: 47.3 },
        { weight: 2350, cgMin: 35.0, cgMax: 47.3 },
        { weight: 3100, cgMin: 41.0, cgMax: 47.3 },
      ]
    }
  },
  'PA28-181': {
    name: 'Piper PA-28-181 Archer',
    emptyWeight: 1540,
    emptyArm: 83.7,
    maxGross: 2550,
    fuelArm: 95.0,
    fuelCapacity: 50,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 80.5, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 118.1, maxWeight: 400 },
      { name: 'Baggage', arm: 142.8, maxWeight: 200 },
    ],
    envelope: {
      points: [
        { weight: 1400, cgMin: 78.0, cgMax: 93.0 },
        { weight: 1800, cgMin: 78.0, cgMax: 93.0 },
        { weight: 2550, cgMin: 84.0, cgMax: 93.0 },
      ]
    }
  }
};

interface StationInput {
  weight: number;
}

// Modal Component
function Modal({ isOpen, onClose, title, children }: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-slate-800 rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-60px)]">
          {children}
        </div>
      </div>
    </div>
  );
}

export default function WeightBalance() {
  const [selectedAircraft, setSelectedAircraft] = useState('C172S');
  const [fuelGallons, setFuelGallons] = useState(40);
  const [stationWeights, setStationWeights] = useState<StationInput[]>([]);
  
  // Profile management state
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [customAircraftList, setCustomAircraftList] = useState<CustomAircraft[]>([]);
  const [selectedProfile, setSelectedProfile] = useState<string>('');
  
  // Modal states
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);
  const [showCustomAircraftModal, setShowCustomAircraftModal] = useState(false);
  const [showImportExportModal, setShowImportExportModal] = useState(false);
  
  // Form states
  const [profileName, setProfileName] = useState('');
  const [editingProfileId, setEditingProfileId] = useState<string | null>(null);
  const [importText, setImportText] = useState('');
  
  // Custom aircraft form
  const [customAircraftForm, setCustomAircraftForm] = useState<CustomAircraft>({
    name: '',
    emptyWeight: 1680,
    emptyArm: 39.0,
    maxGross: 2550,
    fuelArm: 48.0,
    fuelCapacity: 53,
    fuelWeight: 6.0,
    stations: [
      { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
      { name: 'Rear Passengers', arm: 73.0, maxWeight: 400 },
      { name: 'Baggage', arm: 95.0, maxWeight: 120 },
    ],
    envelope: {
      points: [
        { weight: 1500, cgMin: 35.0, cgMax: 47.3 },
        { weight: 2550, cgMin: 41.0, cgMax: 47.3 },
      ]
    }
  });

  // Combined aircraft database (built-in + custom)
  const allAircraft = useMemo(() => {
    const combined: Record<string, AircraftData> = { ...AIRCRAFT_DATABASE };
    customAircraftList.forEach(custom => {
      combined[`custom-${custom.name}`] = {
        ...custom,
        stations: custom.stations.map(s => ({ ...s })),
      };
    });
    return combined;
  }, [customAircraftList]);

  const aircraft = allAircraft[selectedAircraft] || AIRCRAFT_DATABASE['C172S'];

  // Load profiles and custom aircraft on mount
  useEffect(() => {
    setProfiles(getProfiles());
    setCustomAircraftList(getCustomAircraft());
  }, []);

  // Initialize station weights when aircraft changes
  useEffect(() => {
    setStationWeights(aircraft.stations.map(s => ({ weight: s.defaultWeight || 0 })));
    // Load saved preferences
    const saved = localStorage.getItem(`wb-${selectedAircraft}`);
    if (saved) {
      try {
        const data = JSON.parse(saved);
        setFuelGallons(data.fuel || 40);
        if (data.stations) setStationWeights(data.stations);
      } catch {}
    }
  }, [aircraft, selectedAircraft]);

  // Save preferences
  useEffect(() => {
    if (stationWeights.length > 0) {
      localStorage.setItem(`wb-${selectedAircraft}`, JSON.stringify({
        fuel: fuelGallons,
        stations: stationWeights
      }));
    }
  }, [fuelGallons, stationWeights, selectedAircraft]);

  const updateStationWeight = (index: number, weight: number) => {
    const newWeights = [...stationWeights];
    newWeights[index] = { weight: Math.max(0, weight) };
    setStationWeights(newWeights);
  };

  // Profile handlers
  const handleLoadProfile = useCallback((profileId: string) => {
    if (!profileId) {
      setSelectedProfile('');
      return;
    }
    
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    setSelectedProfile(profileId);
    
    // Set aircraft type
    if (profile.customAircraft) {
      // Check if this custom aircraft exists in our list
      const customKey = `custom-${profile.customAircraft.name}`;
      if (!allAircraft[customKey]) {
        // Save the custom aircraft from the profile
        saveCustomAircraft(profile.customAircraft);
        setCustomAircraftList(getCustomAircraft());
      }
      setSelectedAircraft(customKey);
    } else {
      setSelectedAircraft(profile.aircraftType);
    }
    
    // Set fuel and weights after a small delay to let aircraft update
    setTimeout(() => {
      setFuelGallons(profile.fuelGallons);
      setStationWeights(profile.stationWeights.map(w => ({ weight: w })));
    }, 50);
  }, [profiles, allAircraft]);

  const handleSaveProfile = useCallback(() => {
    if (!profileName.trim()) return;
    
    const profileData = {
      name: profileName.trim(),
      aircraftType: selectedAircraft,
      customAircraft: selectedAircraft.startsWith('custom-') 
        ? customAircraftList.find(c => `custom-${c.name}` === selectedAircraft)
        : undefined,
      fuelGallons,
      stationWeights: stationWeights.map(s => s.weight),
    };
    
    if (editingProfileId) {
      updateProfile(editingProfileId, profileData);
    } else {
      createProfile(profileData);
    }
    
    setProfiles(getProfiles());
    setShowSaveModal(false);
    setProfileName('');
    setEditingProfileId(null);
  }, [profileName, selectedAircraft, fuelGallons, stationWeights, editingProfileId, customAircraftList]);

  const handleDeleteProfile = useCallback((id: string) => {
    if (confirm('Delete this profile?')) {
      deleteProfile(id);
      setProfiles(getProfiles());
      if (selectedProfile === id) {
        setSelectedProfile('');
      }
    }
  }, [selectedProfile]);

  const handleEditProfile = useCallback((profile: AircraftProfile) => {
    setProfileName(profile.name);
    setEditingProfileId(profile.id);
    setShowManageModal(false);
    setShowSaveModal(true);
  }, []);

  // Custom aircraft handlers
  const handleSaveCustomAircraft = useCallback(() => {
    if (!customAircraftForm.name.trim()) return;
    
    saveCustomAircraft(customAircraftForm);
    setCustomAircraftList(getCustomAircraft());
    setSelectedAircraft(`custom-${customAircraftForm.name}`);
    setShowCustomAircraftModal(false);
    
    // Reset form
    setCustomAircraftForm({
      name: '',
      emptyWeight: 1680,
      emptyArm: 39.0,
      maxGross: 2550,
      fuelArm: 48.0,
      fuelCapacity: 53,
      fuelWeight: 6.0,
      stations: [
        { name: 'Pilot & Front Pax', arm: 37.0, maxWeight: 400 },
        { name: 'Rear Passengers', arm: 73.0, maxWeight: 400 },
        { name: 'Baggage', arm: 95.0, maxWeight: 120 },
      ],
      envelope: {
        points: [
          { weight: 1500, cgMin: 35.0, cgMax: 47.3 },
          { weight: 2550, cgMin: 41.0, cgMax: 47.3 },
        ]
      }
    });
  }, [customAircraftForm]);

  const handleDeleteCustomAircraft = useCallback((name: string) => {
    if (confirm(`Delete custom aircraft "${name}"?`)) {
      deleteCustomAircraft(name);
      setCustomAircraftList(getCustomAircraft());
      if (selectedAircraft === `custom-${name}`) {
        setSelectedAircraft('C172S');
      }
    }
  }, [selectedAircraft]);

  // Import/Export handlers
  const handleExport = useCallback(() => {
    const json = exportProfiles();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'avweather-profiles.json';
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  const handleImport = useCallback(() => {
    const result = importProfiles(importText);
    if (result.success) {
      setProfiles(getProfiles());
      setShowImportExportModal(false);
      setImportText('');
      alert(`Successfully imported ${result.imported} profile(s)`);
    } else {
      alert(`Import failed: ${result.error}`);
    }
  }, [importText]);

  // Calculate totals
  const calculations = useMemo(() => {
    if (stationWeights.length === 0) return null;

    // Empty weight
    const emptyMoment = aircraft.emptyWeight * aircraft.emptyArm;

    // Fuel
    const fuelWeight = fuelGallons * aircraft.fuelWeight;
    const fuelMoment = fuelWeight * aircraft.fuelArm;

    // Stations
    const stationMoments = stationWeights.map((s, i) => ({
      weight: s.weight,
      arm: aircraft.stations[i]?.arm || 0,
      moment: s.weight * (aircraft.stations[i]?.arm || 0)
    }));

    const totalStationWeight = stationMoments.reduce((sum, s) => sum + s.weight, 0);
    const totalStationMoment = stationMoments.reduce((sum, s) => sum + s.moment, 0);

    // Totals
    const totalWeight = aircraft.emptyWeight + fuelWeight + totalStationWeight;
    const totalMoment = emptyMoment + fuelMoment + totalStationMoment;
    const cg = totalMoment / totalWeight;

    // Check envelope
    const envelope = aircraft.envelope;
    let cgMin = envelope.points[0].cgMin;
    let cgMax = envelope.points[0].cgMax;

    // Interpolate CG limits based on weight
    for (let i = 1; i < envelope.points.length; i++) {
      const prev = envelope.points[i - 1];
      const curr = envelope.points[i];
      if (totalWeight >= prev.weight && totalWeight <= curr.weight) {
        const ratio = (totalWeight - prev.weight) / (curr.weight - prev.weight);
        cgMin = prev.cgMin + ratio * (curr.cgMin - prev.cgMin);
        cgMax = prev.cgMax + ratio * (curr.cgMax - prev.cgMax);
        break;
      } else if (totalWeight > curr.weight && i === envelope.points.length - 1) {
        cgMin = curr.cgMin;
        cgMax = curr.cgMax;
      }
    }

    const withinWeight = totalWeight <= aircraft.maxGross;
    const withinCG = cg >= cgMin && cg <= cgMax;
    const isValid = withinWeight && withinCG;

    return {
      emptyWeight: aircraft.emptyWeight,
      emptyMoment,
      fuelWeight,
      fuelMoment,
      stationMoments,
      totalStationWeight,
      totalWeight,
      totalMoment,
      cg,
      cgMin,
      cgMax,
      withinWeight,
      withinCG,
      isValid,
      overweight: totalWeight - aircraft.maxGross
    };
  }, [aircraft, fuelGallons, stationWeights]);

  // SVG CG Envelope visualization
  const EnvelopeChart = () => {
    if (!calculations) return null;

    const envelope = aircraft.envelope;
    const padding = 30;
    const width = 280;
    const height = 200;
    
    // Find bounds
    const minWeight = envelope.points[0].weight;
    const maxWeight = envelope.points[envelope.points.length - 1].weight;
    const minCG = Math.min(...envelope.points.map(p => p.cgMin)) - 2;
    const maxCG = Math.max(...envelope.points.map(p => p.cgMax)) + 2;

    const scaleX = (cg: number) => padding + ((cg - minCG) / (maxCG - minCG)) * (width - 2 * padding);
    const scaleY = (w: number) => height - padding - ((w - minWeight) / (maxWeight - minWeight)) * (height - 2 * padding);

    // Build envelope path
    const fwdPoints = envelope.points.map(p => `${scaleX(p.cgMin)},${scaleY(p.weight)}`);
    const aftPoints = [...envelope.points].reverse().map(p => `${scaleX(p.cgMax)},${scaleY(p.weight)}`);
    const envelopePath = `M ${fwdPoints.join(' L ')} L ${aftPoints.join(' L ')} Z`;

    // Current CG point
    const cgX = scaleX(calculations.cg);
    const cgY = scaleY(Math.min(calculations.totalWeight, maxWeight));

    return (
      <svg width={width} height={height} className="mx-auto">
        {/* Grid */}
        <defs>
          <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#334155" strokeWidth="0.5"/>
          </pattern>
        </defs>
        <rect x={padding} y="10" width={width - 2*padding} height={height - 2*padding} fill="url(#grid)" />
        
        {/* Envelope */}
        <path 
          d={envelopePath} 
          fill="rgba(34, 197, 94, 0.2)" 
          stroke="#22c55e" 
          strokeWidth="2"
        />
        
        {/* CG Point */}
        <circle 
          cx={cgX} 
          cy={cgY} 
          r="6" 
          fill={calculations.isValid ? '#22c55e' : '#ef4444'}
          stroke="white"
          strokeWidth="2"
        />
        
        {/* Axes labels */}
        <text x={width/2} y={height - 5} textAnchor="middle" className="text-xs fill-slate-400">CG (inches)</text>
        <text x="10" y={height/2} textAnchor="middle" transform={`rotate(-90, 10, ${height/2})`} className="text-xs fill-slate-400">Weight (lbs)</text>
        
        {/* Min/Max labels */}
        <text x={padding} y={height - 10} textAnchor="start" className="text-[10px] fill-slate-500">{minCG.toFixed(0)}</text>
        <text x={width - padding} y={height - 10} textAnchor="end" className="text-[10px] fill-slate-500">{maxCG.toFixed(0)}</text>
        <text x={padding - 5} y={scaleY(minWeight)} textAnchor="end" className="text-[10px] fill-slate-500">{minWeight}</text>
        <text x={padding - 5} y={scaleY(maxWeight)} textAnchor="end" className="text-[10px] fill-slate-500">{maxWeight}</text>
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      {/* Profile Quick Actions */}
      <div className="flex flex-wrap gap-2">
        <select
          value={selectedProfile}
          onChange={(e) => handleLoadProfile(e.target.value)}
          className="flex-1 min-w-[140px] bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">Load Profile...</option>
          {profiles.map(profile => (
            <option key={profile.id} value={profile.id}>
              {profile.name}
            </option>
          ))}
        </select>
        
        <button
          onClick={() => {
            setProfileName('');
            setEditingProfileId(null);
            setShowSaveModal(true);
          }}
          className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors flex items-center gap-1"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
          </svg>
          Save
        </button>
        
        <button
          onClick={() => setShowManageModal(true)}
          className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white text-sm rounded-lg transition-colors"
        >
          Manage
        </button>
      </div>

      {/* Aircraft Selection */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">Aircraft Type</label>
        <div className="flex gap-2">
          <select
            value={selectedAircraft}
            onChange={(e) => {
              setSelectedAircraft(e.target.value);
              setSelectedProfile('');
            }}
            className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <optgroup label="Standard Aircraft">
              {Object.entries(AIRCRAFT_DATABASE).map(([id, data]) => (
                <option key={id} value={id}>{data.name}</option>
              ))}
            </optgroup>
            {customAircraftList.length > 0 && (
              <optgroup label="Custom Aircraft">
                {customAircraftList.map(custom => (
                  <option key={custom.name} value={`custom-${custom.name}`}>
                    {custom.name}
                  </option>
                ))}
              </optgroup>
            )}
          </select>
          
          <button
            onClick={() => setShowCustomAircraftModal(true)}
            className="px-3 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            title="Add Custom Aircraft"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* Fuel Input */}
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-2">
          Fuel ({fuelGallons} gal = {(fuelGallons * aircraft.fuelWeight).toFixed(0)} lbs)
        </label>
        <input
          type="range"
          min="0"
          max={aircraft.fuelCapacity}
          value={fuelGallons}
          onChange={(e) => setFuelGallons(Number(e.target.value))}
          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-blue-500"
        />
        <div className="flex justify-between text-xs text-slate-500 mt-1">
          <span>Empty</span>
          <span>Tabs ({Math.round(aircraft.fuelCapacity * 0.75)})</span>
          <span>Full ({aircraft.fuelCapacity})</span>
        </div>
      </div>

      {/* Station Inputs */}
      <div className="space-y-3">
        <label className="block text-sm font-medium text-slate-400">Payload</label>
        {aircraft.stations.map((station, index) => (
          <div key={index} className="flex items-center gap-3">
            <label className="text-sm text-slate-300 flex-1">{station.name}</label>
            <input
              type="number"
              value={stationWeights[index]?.weight || 0}
              onChange={(e) => updateStationWeight(index, Number(e.target.value))}
              className="w-24 bg-slate-800 border border-slate-700 rounded px-3 py-2 text-right"
              min="0"
              max={station.maxWeight}
            />
            <span className="text-xs text-slate-500 w-12">lbs</span>
          </div>
        ))}
      </div>

      {/* Results */}
      {calculations && (
        <div className="space-y-4">
          {/* CG Envelope Chart */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-400 mb-3 text-center">CG Envelope</h4>
            <EnvelopeChart />
          </div>

          {/* Summary Table */}
          <div className="bg-slate-800/50 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-800">
                  <th className="text-left px-4 py-2 text-slate-400">Item</th>
                  <th className="text-right px-4 py-2 text-slate-400">Weight</th>
                  <th className="text-right px-4 py-2 text-slate-400">Arm</th>
                  <th className="text-right px-4 py-2 text-slate-400">Moment</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                <tr>
                  <td className="px-4 py-2">Empty Weight</td>
                  <td className="text-right px-4 py-2">{calculations.emptyWeight}</td>
                  <td className="text-right px-4 py-2">{aircraft.emptyArm.toFixed(1)}</td>
                  <td className="text-right px-4 py-2">{calculations.emptyMoment.toFixed(0)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-2">Fuel</td>
                  <td className="text-right px-4 py-2">{calculations.fuelWeight.toFixed(0)}</td>
                  <td className="text-right px-4 py-2">{aircraft.fuelArm.toFixed(1)}</td>
                  <td className="text-right px-4 py-2">{calculations.fuelMoment.toFixed(0)}</td>
                </tr>
                {calculations.stationMoments.map((s, i) => (
                  <tr key={i}>
                    <td className="px-4 py-2">{aircraft.stations[i]?.name || `Station ${i+1}`}</td>
                    <td className="text-right px-4 py-2">{s.weight}</td>
                    <td className="text-right px-4 py-2">{s.arm.toFixed(1)}</td>
                    <td className="text-right px-4 py-2">{s.moment.toFixed(0)}</td>
                  </tr>
                ))}
                <tr className="bg-slate-800 font-medium">
                  <td className="px-4 py-2">TOTAL</td>
                  <td className={`text-right px-4 py-2 ${calculations.withinWeight ? 'text-green-400' : 'text-red-400'}`}>
                    {calculations.totalWeight.toFixed(0)}
                  </td>
                  <td className="text-right px-4 py-2"></td>
                  <td className="text-right px-4 py-2">{calculations.totalMoment.toFixed(0)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* CG Result */}
          <div className={`rounded-lg p-4 ${calculations.isValid ? 'bg-green-900/30 border border-green-700' : 'bg-red-900/30 border border-red-700'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-400">Center of Gravity</p>
                <p className={`text-2xl font-bold ${calculations.withinCG ? 'text-green-400' : 'text-red-400'}`}>
                  {calculations.cg.toFixed(2)}" 
                </p>
                <p className="text-xs text-slate-500">
                  Limits: {calculations.cgMin.toFixed(1)}" to {calculations.cgMax.toFixed(1)}"
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-slate-400">Gross Weight</p>
                <p className={`text-2xl font-bold ${calculations.withinWeight ? 'text-green-400' : 'text-red-400'}`}>
                  {calculations.totalWeight.toFixed(0)} lbs
                </p>
                <p className="text-xs text-slate-500">
                  Max: {aircraft.maxGross} lbs
                  {!calculations.withinWeight && (
                    <span className="text-red-400"> (+{calculations.overweight.toFixed(0)})</span>
                  )}
                </p>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 text-center">
              {calculations.isValid ? (
                <span className="text-green-400 font-medium">✓ Within Limits</span>
              ) : (
                <span className="text-red-400 font-medium">✗ Out of Limits</span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Save Profile Modal */}
      <Modal
        isOpen={showSaveModal}
        onClose={() => {
          setShowSaveModal(false);
          setProfileName('');
          setEditingProfileId(null);
        }}
        title={editingProfileId ? 'Edit Profile' : 'Save Profile'}
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-2">Profile Name</label>
            <input
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="e.g., Solo Training, Full Pax, Checkride"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              autoFocus
            />
          </div>
          
          <div className="text-sm text-slate-400 space-y-1">
            <p><strong>Aircraft:</strong> {aircraft.name}</p>
            <p><strong>Fuel:</strong> {fuelGallons} gallons</p>
            <p><strong>Total Weight:</strong> {calculations?.totalWeight.toFixed(0)} lbs</p>
          </div>
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                setShowSaveModal(false);
                setProfileName('');
                setEditingProfileId(null);
              }}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={!profileName.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              {editingProfileId ? 'Update' : 'Save'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Manage Profiles Modal */}
      <Modal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        title="Manage Profiles"
      >
        <div className="space-y-4">
          {profiles.length === 0 ? (
            <p className="text-slate-400 text-center py-8">No saved profiles yet</p>
          ) : (
            <div className="space-y-2">
              {profiles.map(profile => (
                <div
                  key={profile.id}
                  className="flex items-center justify-between p-3 bg-slate-700/50 rounded-lg"
                >
                  <div>
                    <p className="font-medium text-white">{profile.name}</p>
                    <p className="text-xs text-slate-400">
                      {profile.customAircraft?.name || AIRCRAFT_DATABASE[profile.aircraftType]?.name || profile.aircraftType} • {profile.fuelGallons}gal
                    </p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        handleLoadProfile(profile.id);
                        setShowManageModal(false);
                      }}
                      className="p-2 text-blue-400 hover:bg-slate-600 rounded transition-colors"
                      title="Load"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleEditProfile(profile)}
                      className="p-2 text-slate-400 hover:bg-slate-600 rounded transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => handleDeleteProfile(profile.id)}
                      className="p-2 text-red-400 hover:bg-slate-600 rounded transition-colors"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          <div className="flex gap-2 pt-2 border-t border-slate-700">
            <button
              onClick={() => {
                setShowManageModal(false);
                setShowImportExportModal(true);
              }}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors text-sm"
            >
              Import/Export
            </button>
          </div>
        </div>
      </Modal>

      {/* Import/Export Modal */}
      <Modal
        isOpen={showImportExportModal}
        onClose={() => {
          setShowImportExportModal(false);
          setImportText('');
        }}
        title="Import/Export Profiles"
      >
        <div className="space-y-4">
          <div>
            <button
              onClick={handleExport}
              className="w-full px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Export All Profiles
            </button>
          </div>
          
          <div className="border-t border-slate-700 pt-4">
            <label className="block text-sm font-medium text-slate-400 mb-2">Import JSON</label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder="Paste exported JSON here..."
              className="w-full h-32 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <button
              onClick={handleImport}
              disabled={!importText.trim()}
              className="w-full mt-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Import Profiles
            </button>
          </div>
        </div>
      </Modal>

      {/* Custom Aircraft Modal */}
      <Modal
        isOpen={showCustomAircraftModal}
        onClose={() => setShowCustomAircraftModal(false)}
        title="Add Custom Aircraft"
      >
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Aircraft Name</label>
            <input
              type="text"
              value={customAircraftForm.name}
              onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, name: e.target.value })}
              placeholder="e.g., N12345 (My C172)"
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Empty Weight (lbs)</label>
              <input
                type="number"
                value={customAircraftForm.emptyWeight}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, emptyWeight: Number(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Empty Arm (in)</label>
              <input
                type="number"
                step="0.1"
                value={customAircraftForm.emptyArm}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, emptyArm: Number(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Max Gross (lbs)</label>
              <input
                type="number"
                value={customAircraftForm.maxGross}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, maxGross: Number(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fuel Capacity (gal)</label>
              <input
                type="number"
                value={customAircraftForm.fuelCapacity}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, fuelCapacity: Number(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fuel Arm (in)</label>
              <input
                type="number"
                step="0.1"
                value={customAircraftForm.fuelArm}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, fuelArm: Number(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">Fuel Weight (lb/gal)</label>
              <input
                type="number"
                step="0.1"
                value={customAircraftForm.fuelWeight}
                onChange={(e) => setCustomAircraftForm({ ...customAircraftForm, fuelWeight: Number(e.target.value) })}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm"
              />
            </div>
          </div>
          
          <div className="border-t border-slate-700 pt-3">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-slate-400">Stations</label>
              <button
                onClick={() => setCustomAircraftForm({
                  ...customAircraftForm,
                  stations: [...customAircraftForm.stations, { name: 'New Station', arm: 50, maxWeight: 200 }]
                })}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Station
              </button>
            </div>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {customAircraftForm.stations.map((station, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="text"
                    value={station.name}
                    onChange={(e) => {
                      const newStations = [...customAircraftForm.stations];
                      newStations[i] = { ...newStations[i], name: e.target.value };
                      setCustomAircraftForm({ ...customAircraftForm, stations: newStations });
                    }}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Name"
                  />
                  <input
                    type="number"
                    step="0.1"
                    value={station.arm}
                    onChange={(e) => {
                      const newStations = [...customAircraftForm.stations];
                      newStations[i] = { ...newStations[i], arm: Number(e.target.value) };
                      setCustomAircraftForm({ ...customAircraftForm, stations: newStations });
                    }}
                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Arm"
                  />
                  <input
                    type="number"
                    value={station.maxWeight || 200}
                    onChange={(e) => {
                      const newStations = [...customAircraftForm.stations];
                      newStations[i] = { ...newStations[i], maxWeight: Number(e.target.value) };
                      setCustomAircraftForm({ ...customAircraftForm, stations: newStations });
                    }}
                    className="w-16 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Max"
                  />
                  {customAircraftForm.stations.length > 1 && (
                    <button
                      onClick={() => {
                        const newStations = customAircraftForm.stations.filter((_, idx) => idx !== i);
                        setCustomAircraftForm({ ...customAircraftForm, stations: newStations });
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
          
          <div className="border-t border-slate-700 pt-3">
            <label className="text-sm font-medium text-slate-400 mb-2 block">CG Envelope (Forward/Aft Limits)</label>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {customAircraftForm.envelope.points.map((point, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <input
                    type="number"
                    value={point.weight}
                    onChange={(e) => {
                      const newPoints = [...customAircraftForm.envelope.points];
                      newPoints[i] = { ...newPoints[i], weight: Number(e.target.value) };
                      setCustomAircraftForm({ ...customAircraftForm, envelope: { points: newPoints } });
                    }}
                    className="w-20 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Weight"
                  />
                  <span className="text-slate-500 text-xs">lbs @</span>
                  <input
                    type="number"
                    step="0.1"
                    value={point.cgMin}
                    onChange={(e) => {
                      const newPoints = [...customAircraftForm.envelope.points];
                      newPoints[i] = { ...newPoints[i], cgMin: Number(e.target.value) };
                      setCustomAircraftForm({ ...customAircraftForm, envelope: { points: newPoints } });
                    }}
                    className="w-14 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Fwd"
                  />
                  <span className="text-slate-500 text-xs">-</span>
                  <input
                    type="number"
                    step="0.1"
                    value={point.cgMax}
                    onChange={(e) => {
                      const newPoints = [...customAircraftForm.envelope.points];
                      newPoints[i] = { ...newPoints[i], cgMax: Number(e.target.value) };
                      setCustomAircraftForm({ ...customAircraftForm, envelope: { points: newPoints } });
                    }}
                    className="w-14 bg-slate-700 border border-slate-600 rounded px-2 py-1 text-white text-xs"
                    placeholder="Aft"
                  />
                  <span className="text-slate-500 text-xs">in</span>
                  {customAircraftForm.envelope.points.length > 2 && (
                    <button
                      onClick={() => {
                        const newPoints = customAircraftForm.envelope.points.filter((_, idx) => idx !== i);
                        setCustomAircraftForm({ ...customAircraftForm, envelope: { points: newPoints } });
                      }}
                      className="text-red-400 hover:text-red-300 p-1"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
              <button
                onClick={() => setCustomAircraftForm({
                  ...customAircraftForm,
                  envelope: {
                    points: [...customAircraftForm.envelope.points, { weight: 2000, cgMin: 35, cgMax: 47 }]
                  }
                })}
                className="text-xs text-blue-400 hover:text-blue-300"
              >
                + Add Point
              </button>
            </div>
          </div>
          
          {/* Custom aircraft delete list */}
          {customAircraftList.length > 0 && (
            <div className="border-t border-slate-700 pt-3">
              <label className="text-sm font-medium text-slate-400 mb-2 block">Saved Custom Aircraft</label>
              <div className="space-y-1">
                {customAircraftList.map(ac => (
                  <div key={ac.name} className="flex items-center justify-between p-2 bg-slate-700/50 rounded">
                    <span className="text-sm text-white">{ac.name}</span>
                    <button
                      onClick={() => handleDeleteCustomAircraft(ac.name)}
                      className="text-red-400 hover:text-red-300 text-xs"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          
          <div className="flex gap-2 pt-2">
            <button
              onClick={() => setShowCustomAircraftModal(false)}
              className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveCustomAircraft}
              disabled={!customAircraftForm.name.trim()}
              className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors"
            >
              Save Aircraft
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

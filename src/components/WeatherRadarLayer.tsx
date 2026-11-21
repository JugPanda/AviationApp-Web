'use client';

import { useEffect, useState } from 'react';
import { TileLayer } from 'react-leaflet';

interface WeatherRadarLayerProps {
  visible: boolean;
}

interface RadarFrame {
  time: number;
  path: string;
}

// Commercial RainViewer use requires authorization; never enable by default.
const RAINVIEWER_API = 'https://api.rainviewer.com/public/weather-maps.json';

export default function WeatherRadarLayer({ visible }: WeatherRadarLayerProps) {
  if (!visible) return null;

  // Gate the entire network-owning component: no metadata fetch, refresh timer,
  // animation, or tile layer can mount without an explicit deployment opt-in.
  if (process.env.NEXT_PUBLIC_ENABLE_LICENSED_RADAR !== 'true') {
    return (
      <div className="leaflet-bottom leaflet-left" style={{ marginBottom: '20px', marginLeft: '10px' }}>
        <div role="status" className="leaflet-control rounded-lg border border-amber-700 bg-slate-900 p-3 text-xs text-amber-100" style={{ maxWidth: '280px' }}>
          <strong className="block mb-1">Radar unavailable — licensing pending</strong>
          RainViewer is disabled until commercial-use permission is confirmed and this deployment is explicitly enabled. No radar data is loaded.
        </div>
      </div>
    );
  }

  return <LicensedWeatherRadarLayer visible={visible} />;
}

function LicensedWeatherRadarLayer({ visible }: WeatherRadarLayerProps) {
  const [radarUrl, setRadarUrl] = useState<string | null>(null);
  const [frames, setFrames] = useState<RadarFrame[]>([]);
  const [currentFrame, setCurrentFrame] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);

  // Fetch available frames and refresh while the authorized layer is mounted.
  useEffect(() => {
    if (!visible) return;

    const fetchRadarData = async () => {
      try {
        const response = await fetch(RAINVIEWER_API);
        if (!response.ok) throw new Error('Failed to fetch radar data');

        const data = await response.json();

        if (data.radar && data.radar.past) {
          const radarFrames: RadarFrame[] = data.radar.past.map((frame: { time: number; path: string }) => ({
            time: frame.time,
            path: frame.path
          }));

          // Add nowcast/forecast frames if available
          if (data.radar.nowcast) {
            data.radar.nowcast.forEach((frame: { time: number; path: string }) => {
              radarFrames.push({
                time: frame.time,
                path: frame.path
              });
            });
          }

          setFrames(radarFrames);

          // Set to most recent frame
          if (radarFrames.length > 0) {
            const latestIndex = data.radar.past.length - 1;
            setCurrentFrame(latestIndex);
            setRadarUrl(`https://tilecache.rainviewer.com${radarFrames[latestIndex].path}/256/{z}/{x}/{y}/2/1_1.png`);
          }

          setLastUpdate(new Date());
        }
      } catch (error) {
        console.error('Radar fetch error:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchRadarData();

    // Refresh every 5 minutes
    const interval = setInterval(() => {
      setLoading(true);
      void fetchRadarData();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [visible]);

  // Animation logic
  useEffect(() => {
    if (!isAnimating || frames.length === 0) return;
    
    const interval = setInterval(() => {
      setCurrentFrame(prev => {
        const next = (prev + 1) % frames.length;
        setRadarUrl(`https://tilecache.rainviewer.com${frames[next].path}/256/{z}/{x}/{y}/2/1_1.png`);
        return next;
      });
    }, 500); // 500ms per frame
    
    return () => clearInterval(interval);
  }, [isAnimating, frames]);

  // Update URL when frame changes manually
  const handleFrameChange = (index: number) => {
    setCurrentFrame(index);
    if (frames[index]) {
      setRadarUrl(`https://tilecache.rainviewer.com${frames[index].path}/256/{z}/{x}/{y}/2/1_1.png`);
    }
  };

  if (!visible || !radarUrl) return null;

  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp * 1000);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  };

  return (
    <>
      <TileLayer
        url={radarUrl}
        opacity={0.7}
        attribution='&copy; <a href="https://rainviewer.com">RainViewer</a>'
      />
      
      {/* Radar Controls Overlay */}
      <div className="leaflet-bottom leaflet-left" style={{ marginBottom: '20px', marginLeft: '10px' }}>
        <div 
          className="leaflet-control"
          style={{
            background: 'rgba(15, 23, 42, 0.9)',
            backdropFilter: 'blur(8px)',
            borderRadius: '8px',
            padding: '8px 12px',
            color: 'white',
            fontSize: '12px',
            minWidth: '200px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
            <span style={{ fontWeight: 'bold', color: '#60a5fa' }}>🌧️ Radar</span>
            <span style={{ color: '#94a3b8' }}>
              {frames[currentFrame] ? formatTime(frames[currentFrame].time) : '--:--'}
            </span>
          </div>
          
          {/* Timeline slider */}
          <input
            type="range"
            min={0}
            max={frames.length - 1}
            value={currentFrame}
            onChange={(e) => handleFrameChange(parseInt(e.target.value))}
            style={{
              width: '100%',
              height: '4px',
              cursor: 'pointer',
              accentColor: '#3b82f6'
            }}
          />
          
          {/* Controls */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '6px' }}>
            <button
              onClick={() => setIsAnimating(!isAnimating)}
              style={{
                background: isAnimating ? '#ef4444' : '#22c55e',
                border: 'none',
                borderRadius: '4px',
                padding: '4px 12px',
                color: 'white',
                cursor: 'pointer',
                fontSize: '11px',
                fontWeight: 'bold'
              }}
            >
              {isAnimating ? '⏹ Stop' : '▶ Play'}
            </button>
            
            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={() => handleFrameChange(Math.max(0, currentFrame - 1))}
                disabled={currentFrame === 0}
                style={{
                  background: '#334155',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  color: currentFrame === 0 ? '#64748b' : 'white',
                  cursor: currentFrame === 0 ? 'not-allowed' : 'pointer',
                  fontSize: '11px'
                }}
              >
                ◀
              </button>
              <button
                onClick={() => handleFrameChange(Math.min(frames.length - 1, currentFrame + 1))}
                disabled={currentFrame === frames.length - 1}
                style={{
                  background: '#334155',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 8px',
                  color: currentFrame === frames.length - 1 ? '#64748b' : 'white',
                  cursor: currentFrame === frames.length - 1 ? 'not-allowed' : 'pointer',
                  fontSize: '11px'
                }}
              >
                ▶
              </button>
            </div>
          </div>
          
          {/* Legend */}
          {lastUpdate && (
            <p style={{ color: '#94a3b8', marginTop: '6px', fontSize: '10px' }}>
              Retrieved {lastUpdate.toLocaleTimeString()} · Not for tactical weather avoidance
            </p>
          )}
          <div style={{ marginTop: '8px', paddingTop: '6px', borderTop: '1px solid #334155' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px' }}>
              <span style={{ color: '#94a3b8' }}>Light</span>
              <div style={{ 
                flex: 1, 
                height: '8px', 
                background: 'linear-gradient(to right, #00ff00, #ffff00, #ff8800, #ff0000, #ff00ff)',
                borderRadius: '2px'
              }} />
              <span style={{ color: '#94a3b8' }}>Heavy</span>
            </div>
          </div>
          
          {loading && (
            <div style={{ textAlign: 'center', color: '#64748b', marginTop: '4px', fontSize: '10px' }}>
              Updating...
            </div>
          )}
        </div>
      </div>
    </>
  );
}

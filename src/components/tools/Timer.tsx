'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

type TimerMode = 'stopwatch' | 'countdown' | 'hobbs';

interface Lap {
  number: number;
  time: number;
  split: number;
}

export default function Timer() {
  const [mode, setMode] = useState<TimerMode>('stopwatch');
  
  // Stopwatch state
  const [isRunning, setIsRunning] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [laps, setLaps] = useState<Lap[]>([]);
  const startTimeRef = useRef<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  // Countdown state
  const [countdownMinutes, setCountdownMinutes] = useState<string>('30');
  const [countdownSeconds, setCountdownSeconds] = useState<string>('00');
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [countdownRunning, setCountdownRunning] = useState(false);
  
  // Hobbs state
  const [blockOut, setBlockOut] = useState<string>('');
  const [blockIn, setBlockIn] = useState<string>('');
  const [hobbsStart, setHobbsStart] = useState<string>('');
  const [hobbsEnd, setHobbsEnd] = useState<string>('');

  // Stopwatch logic
  useEffect(() => {
    if (isRunning) {
      startTimeRef.current = Date.now() - elapsedMs;
      intervalRef.current = setInterval(() => {
        setElapsedMs(Date.now() - startTimeRef.current);
      }, 10);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  // Countdown logic
  useEffect(() => {
    if (countdownRunning && countdownRemaining > 0) {
      const timer = setInterval(() => {
        setCountdownRemaining(prev => {
          if (prev <= 100) {
            setCountdownRunning(false);
            // Play alert sound (if available)
            try {
              const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2teleDoAHIHO7/S5chYAL5nT8u2lcCAAPJ3U8umWYg8ATqHQ7t17Pw0Aaa3N5cZUKAEAgrrI2a0+GgCLw8PNnzIPAJPGvsa9JgcAmcW0usYfAwCdw6u3xRsAAKHBorTGGAAApsCbtMMWAACqvpWywBYAAK29j7C9FgAAr7yKrroXAACwu4asthgAALG6gqq0GQAAsrmAqLEaAACyuH2mrxoAALO3e6WuGgAAs7Z5pK0ZAACztXmjqxgAALO1eKKpFwAAs7R3oagWAACytHafoRcAAA==');
              audio.play();
            } catch {}
            return 0;
          }
          return prev - 100;
        });
      }, 100);
      return () => clearInterval(timer);
    }
  }, [countdownRunning, countdownRemaining]);

  const formatTime = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    const hundredths = Math.floor((ms % 1000) / 10);
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${hundredths.toString().padStart(2, '0')}`;
  };

  const formatCountdown = (ms: number): string => {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  const toggleStopwatch = useCallback(() => {
    setIsRunning(prev => !prev);
  }, []);

  const resetStopwatch = useCallback(() => {
    setIsRunning(false);
    setElapsedMs(0);
    setLaps([]);
  }, []);

  const addLap = useCallback(() => {
    const lastLapTime = laps.length > 0 ? laps[laps.length - 1].time : 0;
    setLaps(prev => [
      ...prev,
      {
        number: prev.length + 1,
        time: elapsedMs,
        split: elapsedMs - lastLapTime
      }
    ]);
  }, [elapsedMs, laps]);

  const startCountdown = useCallback(() => {
    const mins = parseInt(countdownMinutes) || 0;
    const secs = parseInt(countdownSeconds) || 0;
    const totalMs = (mins * 60 + secs) * 1000;
    
    if (totalMs > 0) {
      setCountdownRemaining(totalMs);
      setCountdownRunning(true);
    }
  }, [countdownMinutes, countdownSeconds]);

  const resetCountdown = useCallback(() => {
    setCountdownRunning(false);
    setCountdownRemaining(0);
  }, []);

  // Hobbs calculations
  const calculateBlockTime = (): string => {
    if (!blockOut || !blockIn) return '--:--';
    
    const [outH, outM] = blockOut.split(':').map(Number);
    const [inH, inM] = blockIn.split(':').map(Number);
    
    let totalMinutes = (inH * 60 + inM) - (outH * 60 + outM);
    if (totalMinutes < 0) totalMinutes += 24 * 60;
    
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    
    return `${hours}:${minutes.toString().padStart(2, '0')}`;
  };

  const calculateHobbsTime = (): string => {
    if (!hobbsStart || !hobbsEnd) return '--.-';
    
    const start = parseFloat(hobbsStart) || 0;
    const end = parseFloat(hobbsEnd) || 0;
    
    return (end - start).toFixed(1);
  };

  const setCurrentTime = (setter: (val: string) => void) => {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    setter(`${hours}:${minutes}`);
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-lg font-semibold text-white mb-2">Flight Timer</h3>
        <p className="text-sm text-slate-400">Stopwatch, countdown & Hobbs tracker</p>
      </div>

      {/* Mode Selection */}
      <div className="bg-slate-800/50 rounded-lg p-4">
        <div className="grid grid-cols-3 gap-2">
          {[
            { key: 'stopwatch', label: '⏱️ Stopwatch' },
            { key: 'countdown', label: '⏳ Countdown' },
            { key: 'hobbs', label: '✈️ Hobbs' }
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setMode(key as TimerMode)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                mode === key ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stopwatch Mode */}
      {mode === 'stopwatch' && (
        <div className="space-y-6">
          {/* Timer Display */}
          <div className="bg-slate-800/50 rounded-lg p-8 text-center">
            <p className={`font-mono text-5xl ${isRunning ? 'text-green-400' : 'text-white'}`}>
              {formatTime(elapsedMs)}
            </p>
          </div>

          {/* Controls */}
          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={resetStopwatch}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Reset
            </button>
            <button
              onClick={toggleStopwatch}
              className={`px-4 py-3 rounded-lg transition-colors font-medium ${
                isRunning 
                  ? 'bg-red-600 hover:bg-red-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {isRunning ? 'Stop' : 'Start'}
            </button>
            <button
              onClick={addLap}
              disabled={!isRunning}
              className="px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 text-white rounded-lg transition-colors"
            >
              Lap
            </button>
          </div>

          {/* Laps */}
          {laps.length > 0 && (
            <div className="bg-slate-800/50 rounded-lg overflow-hidden">
              <div className="px-4 py-2 bg-slate-800 border-b border-slate-700">
                <p className="text-sm font-medium text-slate-400">Laps</p>
              </div>
              <div className="max-h-48 overflow-y-auto">
                {[...laps].reverse().map((lap) => (
                  <div key={lap.number} className="flex justify-between px-4 py-2 border-b border-slate-700/50 text-sm">
                    <span className="text-slate-400">Lap {lap.number}</span>
                    <span className="text-slate-300 font-mono">+{formatTime(lap.split)}</span>
                    <span className="text-white font-mono">{formatTime(lap.time)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Countdown Mode */}
      {mode === 'countdown' && (
        <div className="space-y-6">
          {/* Set Time (when not running) */}
          {!countdownRunning && countdownRemaining === 0 && (
            <div className="bg-slate-800/50 rounded-lg p-4">
              <label className="block text-sm font-medium text-slate-400 mb-3">Set Timer</label>
              <div className="flex items-center justify-center gap-2">
                <input
                  type="number"
                  value={countdownMinutes}
                  onChange={(e) => setCountdownMinutes(e.target.value)}
                  className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-3 text-white text-2xl text-center font-mono"
                  min="0"
                  max="99"
                />
                <span className="text-2xl text-slate-400">:</span>
                <input
                  type="number"
                  value={countdownSeconds}
                  onChange={(e) => setCountdownSeconds(e.target.value)}
                  className="w-20 bg-slate-700 border border-slate-600 rounded-lg px-3 py-3 text-white text-2xl text-center font-mono"
                  min="0"
                  max="59"
                />
              </div>
              
              {/* Quick presets */}
              <div className="flex gap-2 mt-3 justify-center">
                {[
                  { label: '1:00', m: '1', s: '00' },
                  { label: '3:00', m: '3', s: '00' },
                  { label: '5:00', m: '5', s: '00' },
                  { label: '10:00', m: '10', s: '00' },
                  { label: '30:00', m: '30', s: '00' },
                ].map((preset) => (
                  <button
                    key={preset.label}
                    onClick={() => {
                      setCountdownMinutes(preset.m);
                      setCountdownSeconds(preset.s);
                    }}
                    className="px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 text-sm rounded transition-colors"
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Display */}
          {(countdownRunning || countdownRemaining > 0) && (
            <div className={`rounded-lg p-8 text-center ${
              countdownRemaining <= 10000 && countdownRemaining > 0 
                ? 'bg-red-900/50 border border-red-700' 
                : 'bg-slate-800/50'
            }`}>
              <p className={`font-mono text-6xl ${
                countdownRemaining <= 10000 && countdownRemaining > 0 
                  ? 'text-red-400 animate-pulse' 
                  : countdownRunning ? 'text-green-400' : 'text-white'
              }`}>
                {formatCountdown(countdownRemaining)}
              </p>
              {countdownRemaining === 0 && (
                <p className="text-red-400 text-xl mt-2 animate-bounce">⏰ TIME!</p>
              )}
            </div>
          )}

          {/* Controls */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={resetCountdown}
              className="px-4 py-3 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              Reset
            </button>
            <button
              onClick={() => {
                if (countdownRunning) {
                  setCountdownRunning(false);
                } else if (countdownRemaining > 0) {
                  setCountdownRunning(true);
                } else {
                  startCountdown();
                }
              }}
              className={`px-4 py-3 rounded-lg transition-colors font-medium ${
                countdownRunning 
                  ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
            >
              {countdownRunning ? 'Pause' : countdownRemaining > 0 ? 'Resume' : 'Start'}
            </button>
          </div>
        </div>
      )}

      {/* Hobbs Mode */}
      {mode === 'hobbs' && (
        <div className="space-y-4">
          {/* Block Times */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-400 mb-3">Block Times</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Block Out</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={blockOut}
                    onChange={(e) => setBlockOut(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                  <button
                    onClick={() => setCurrentTime(setBlockOut)}
                    className="px-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg text-xs"
                    title="Set current time"
                  >
                    Now
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Block In</label>
                <div className="flex gap-2">
                  <input
                    type="time"
                    value={blockIn}
                    onChange={(e) => setBlockIn(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  />
                  <button
                    onClick={() => setCurrentTime(setBlockIn)}
                    className="px-2 py-2 bg-slate-700 hover:bg-slate-600 text-slate-400 rounded-lg text-xs"
                    title="Set current time"
                  >
                    Now
                  </button>
                </div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 text-center">
              <p className="text-slate-400 text-sm">Block Time</p>
              <p className="text-2xl font-bold text-white font-mono">{calculateBlockTime()}</p>
            </div>
          </div>

          {/* Hobbs */}
          <div className="bg-slate-800/50 rounded-lg p-4">
            <h4 className="text-sm font-medium text-slate-400 mb-3">Hobbs Meter</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hobbs Start</label>
                <input
                  type="number"
                  value={hobbsStart}
                  onChange={(e) => setHobbsStart(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="1234.5"
                  step="0.1"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">Hobbs End</label>
                <input
                  type="number"
                  value={hobbsEnd}
                  onChange={(e) => setHobbsEnd(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white"
                  placeholder="1236.0"
                  step="0.1"
                />
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-700 text-center">
              <p className="text-slate-400 text-sm">Flight Time (Hobbs)</p>
              <p className="text-2xl font-bold text-green-400 font-mono">{calculateHobbsTime()} hrs</p>
            </div>
          </div>

          {/* Summary */}
          {(blockOut && blockIn) || (hobbsStart && hobbsEnd) ? (
            <div className="bg-blue-900/30 border border-blue-700 rounded-lg p-4">
              <h4 className="text-blue-400 font-medium mb-2">Flight Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                {blockOut && blockIn && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Block Time:</span>
                    <span className="text-white font-mono">{calculateBlockTime()}</span>
                  </div>
                )}
                {hobbsStart && hobbsEnd && (
                  <div className="flex justify-between">
                    <span className="text-slate-400">Hobbs:</span>
                    <span className="text-white font-mono">{calculateHobbsTime()} hrs</span>
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

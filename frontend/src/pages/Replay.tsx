import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format, subHours, subDays } from 'date-fns';
import { 
  PlayIcon, 
  PauseIcon, 
  StopIcon,
  ClockIcon,
  ChartBarIcon 
} from '@heroicons/react/24/outline';
import { useEventsApiStore } from '../stores/eventsApiStore';
import { useWebSocketStore } from '../stores/websocketStore';
import { useMetricsStore } from '../stores/metricsStore';

const Replay: React.FC = () => {
  const { events, fetchEvents, totalCount } = useEventsApiStore();
  const { isConnected, startReplay, stopReplay, isReplaying } = useWebSocketStore();
  const { metrics } = useMetricsStore();
  
  const [startTime, setStartTime] = useState<Date>(subHours(new Date(), 1));
  const [endTime, setEndTime] = useState<Date>(new Date());
  const [speed, setSpeed] = useState(1);
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [replayEvents, setReplayEvents] = useState<any[]>([]);
  const [currentEventIndex, setCurrentEventIndex] = useState(0);

  const sources = Array.from(new Set(events.map(e => e.source)));
  const types = Array.from(new Set(events.map(e => e.type)));

  const availableEvents = events.filter(event => {
    const eventTime = event.timestamp;
    return eventTime >= startTime.getTime() && eventTime <= endTime.getTime();
  });

  const filteredAvailableEvents = availableEvents.filter(event => {
    if (selectedSources.length > 0 && !selectedSources.includes(event.source)) {
      return false;
    }
    if (selectedTypes.length > 0 && !selectedTypes.includes(event.type)) {
      return false;
    }
    return true;
  });

  const handleStartReplay = () => {
    if (!isConnected) {
      alert('Please connect to the WebSocket first');
      return;
    }

    if (filteredAvailableEvents.length === 0) {
      alert('No events available for the selected time range and filters');
      return;
    }

    const config = {
      startTime: startTime.getTime(),
      endTime: endTime.getTime(),
      speed,
      filters: {
        sources: selectedSources.length > 0 ? selectedSources : undefined,
        types: selectedTypes.length > 0 ? selectedTypes : undefined,
      },
    };

    startReplay(config);
    setReplayEvents(filteredAvailableEvents);
    setCurrentEventIndex(0);
    
    console.log(`Starting replay with ${filteredAvailableEvents.length} events at ${speed}x speed`);
  };

  const handleStopReplay = () => {
    stopReplay();
    setReplayEvents([]);
    setCurrentEventIndex(0);
  };

  const handleSourceToggle = (source: string) => {
    setSelectedSources(prev => 
      prev.includes(source) 
        ? prev.filter(s => s !== source)
        : [...prev, source]
    );
  };

  const handleTypeToggle = (type: string) => {
    setSelectedTypes(prev => 
      prev.includes(type) 
        ? prev.filter(t => t !== type)
        : [...prev, type]
    );
  };

  const handleQuickTimeRange = (range: string) => {
    const now = new Date();
    switch (range) {
      case '1h':
        setStartTime(subHours(now, 1));
        setEndTime(now);
        break;
      case '6h':
        setStartTime(subHours(now, 6));
        setEndTime(now);
        break;
      case '24h':
        setStartTime(subDays(now, 1));
        setEndTime(now);
        break;
      case '7d':
        setStartTime(subDays(now, 7));
        setEndTime(now);
        break;
    }
  };

  useEffect(() => {
    fetchEvents(100);
  }, [fetchEvents]);

  useEffect(() => {
    if (!isReplaying || filteredAvailableEvents.length === 0) return;

    const interval = setInterval(() => {
      setCurrentEventIndex(prev => {
        if (prev >= filteredAvailableEvents.length - 1) {
          stopReplay();
          return 0;
        }
        return prev + 1;
      });
    }, 1000 / speed);

    return () => clearInterval(interval);
  }, [isReplaying, filteredAvailableEvents.length, speed, stopReplay]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Event Replay</h1>
          <p className="text-gray-600">
            Replay historical events with configurable time ranges and playback speeds
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <div className={`
            flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm
            ${isReplaying 
              ? 'bg-warning-100 text-warning-700' 
              : 'bg-gray-100 text-gray-600'
            }
          `}>
            <ClockIcon className="w-4 h-4" />
            <span>{isReplaying ? 'Replaying' : 'Ready'}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Time Range</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Start Time
              </label>
              <input
                type="datetime-local"
                value={format(startTime, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => setStartTime(new Date(e.target.value))}
                className="input"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                End Time
              </label>
              <input
                type="datetime-local"
                value={format(endTime, "yyyy-MM-dd'T'HH:mm")}
                onChange={(e) => setEndTime(new Date(e.target.value))}
                className="input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Quick Ranges
              </label>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { label: '1 Hour', value: '1h' },
                  { label: '6 Hours', value: '6h' },
                  { label: '24 Hours', value: '24h' },
                  { label: '7 Days', value: '7d' },
                ].map(range => (
                  <button
                    key={range.value}
                    onClick={() => handleQuickTimeRange(range.value)}
                    className="btn btn-secondary text-xs"
                  >
                    {range.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Playback</h3>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Speed (events/second)
              </label>
              <input
                type="range"
                min="0.1"
                max="10"
                step="0.1"
                value={speed}
                onChange={(e) => setSpeed(parseFloat(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-gray-500 mt-1">
                <span>0.1x</span>
                <span className="font-medium">{speed}x</span>
                <span>10x</span>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {!isReplaying ? (
                <button
                  onClick={handleStartReplay}
                  disabled={!isConnected || availableEvents.length === 0}
                  className="btn btn-primary flex items-center space-x-2 flex-1"
                >
                  <PlayIcon className="w-4 h-4" />
                  <span>Start Replay</span>
                </button>
              ) : (
                <button
                  onClick={handleStopReplay}
                  className="btn btn-danger flex items-center space-x-2 flex-1"
                >
                  <StopIcon className="w-4 h-4" />
                  <span>Stop Replay</span>
                </button>
              )}
            </div>

            <div className="text-center p-3 bg-gray-50 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">
                {filteredAvailableEvents.length}
              </div>
              <div className="text-sm text-gray-600">Events Available</div>
              <div className="text-xs text-gray-500 mt-1">
                Total: {totalCount || 0}
              </div>
            </div>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
          
          <div className="space-y-4">
            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Sources</h4>
              <div className="space-y-2">
                {sources.map(source => (
                  <label key={source} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedSources.includes(source)}
                      onChange={() => handleSourceToggle(source)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      {source.replace('_', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h4 className="text-sm font-medium text-gray-700 mb-2">Event Types</h4>
              <div className="space-y-2">
                {types.map(type => (
                  <label key={type} className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      checked={selectedTypes.includes(type)}
                      onChange={() => handleTypeToggle(type)}
                      className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                    />
                    <span className="text-sm text-gray-700">
                      {type.replace('_', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {isReplaying && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Replay Progress</h3>
            <div className="flex items-center space-x-2">
              <ChartBarIcon className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-600">
                {currentEventIndex} / {filteredAvailableEvents.length} events
              </span>
            </div>
          </div>
          
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-primary-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${(currentEventIndex / filteredAvailableEvents.length) * 100}%` }}
            />
          </div>
        </motion.div>
      )}

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">
            {isReplaying ? 'Replaying Events' : 'Available Events'}
          </h3>
          <span className="text-sm text-gray-600">
            {isReplaying ? `${currentEventIndex} / ${filteredAvailableEvents.length}` : filteredAvailableEvents.length} events
          </span>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredAvailableEvents.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-400 text-4xl mb-2">⏰</div>
              <p className="text-gray-600">
                {events.length === 0 
                  ? 'No events loaded yet. Fetching from AWS...' 
                  : 'No events match the selected time range and filters'
                }
              </p>
            </div>
          ) : (
            filteredAvailableEvents.map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={`
                  ${isReplaying && index === currentEventIndex 
                    ? 'ring-2 ring-primary-500 bg-primary-50' 
                    : ''
                  }
                  ${isReplaying ? 'opacity-75' : ''}
                `}
              >
                <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {event.source.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {event.type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(event.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {event.source === 'iot_sensors' && (
                      <span>
                        Sensor {event.data.sensorId}: {event.data.value} {event.data.unit}
                      </span>
                    )}
                    {event.source === 'stock_market' && (
                      <span>
                        Price: ${event.data.price}
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default Replay;

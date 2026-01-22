import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon,
  ArrowDownTrayIcon,
  TrashIcon 
} from '@heroicons/react/24/outline';
import { useEventsApiStore } from '../stores/eventsApiStore';
import { useWebSocketStore } from '../stores/websocketStore';
import EventCard from '../components/EventCard';

const Events: React.FC = () => {
  const { events, isLoading, error, totalCount, fetchEvents, clearEvents } = useEventsApiStore();
  const { isConnected, subscribe, unsubscribe } = useWebSocketStore();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);

  const sources = Array.from(new Set(events.map(e => e.source)));
  const types = Array.from(new Set(events.map(e => e.type)));

  useEffect(() => {
    if (isConnected) {
      subscribe(['stock_market', 'iot_sensors'], ['stock_price', 'sensor_reading']);
    }

    return () => {
      if (isConnected) {
        unsubscribe(['stock_market', 'iot_sensors'], ['stock_price', 'sensor_reading']);
      }
    };
  }, [isConnected, subscribe, unsubscribe]);

  useEffect(() => {
    fetchEvents(100);
  }, [fetchEvents]);

  useEffect(() => {
    fetchEvents(100);
  }, [fetchEvents]);

  const filteredBySearch = events.filter(event => {
    if (selectedSources.length > 0 && !selectedSources.includes(event.source)) {
      return false;
    }
    
    if (selectedTypes.length > 0 && !selectedTypes.includes(event.type)) {
      return false;
    }
    
    if (!searchTerm) return true;
    
    const searchLower = searchTerm.toLowerCase();
    return (
      event.id.toLowerCase().includes(searchLower) ||
      event.source.toLowerCase().includes(searchLower) ||
      event.type.toLowerCase().includes(searchLower) ||
      JSON.stringify(event.data).toLowerCase().includes(searchLower)
    );
  });

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

  const handleClearAll = () => {
    setSearchTerm('');
    setSelectedSources([]);
    setSelectedTypes([]);
    fetchEvents(100);
  };

  const handleExportEvents = () => {
    const dataStr = JSON.stringify(filteredBySearch, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `events-${format(new Date(), 'yyyy-MM-dd-HH-mm')}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Events</h1>
          <p className="text-gray-600">
            View and manage all events in the system ({filteredBySearch.length} of {totalCount})
            {isLoading && <span className="ml-2 text-blue-600">Loading...</span>}
          </p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleExportEvents}
            className="btn btn-secondary flex items-center space-x-2"
          >
            <ArrowDownTrayIcon className="w-4 h-4" />
            <span>Export</span>
          </button>
          
          <button
            onClick={clearEvents}
            className="btn btn-danger flex items-center space-x-2"
          >
            <TrashIcon className="w-4 h-4" />
            <span>Clear All</span>
          </button>
        </div>
      </div>

      <div className="card">
        <div className="flex items-center space-x-4 mb-4">
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search events..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input pl-10"
            />
          </div>
          
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn flex items-center space-x-2 ${
              showFilters ? 'btn-primary' : 'btn-secondary'
            }`}
          >
            <FunnelIcon className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-gray-200 pt-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-900 mb-3">Sources</h4>
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
                <h4 className="text-sm font-medium text-gray-900 mb-3">Event Types</h4>
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

            <div className="mt-4 pt-4 border-t border-gray-200">
              <button
                onClick={handleClearAll}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Clear all filters
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <span className="text-red-600">⚠️</span>
            <span className="text-red-800">Error loading events: {error}</span>
          </div>
        </motion.div>
      )}

      <div className="space-y-4">
        {filteredBySearch.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-center py-12"
          >
            <div className="text-gray-400 text-6xl mb-4">📊</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {isLoading ? 'Loading events...' : 'No events found'}
            </h3>
            <p className="text-gray-600">
              {isLoading 
                ? 'Fetching events from your AWS infrastructure...' 
                : events.length === 0 
                  ? 'No events have been received yet. Make sure the data ingestion is running.'
                  : 'Try adjusting your search or filters to see more events.'
              }
            </p>
          </motion.div>
        ) : (
          filteredBySearch.map((event, index) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.05 }}
            >
              <EventCard event={event} />
            </motion.div>
          ))
        )}
      </div>

      {filteredBySearch.length > 0 && (
        <div className="text-center">
          <button className="btn btn-secondary">
            Load More Events
          </button>
        </div>
      )}
    </div>
  );
};

export default Events;

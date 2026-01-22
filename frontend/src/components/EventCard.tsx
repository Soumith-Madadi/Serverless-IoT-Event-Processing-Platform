import React from 'react';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Event } from '../stores/eventStore';

interface EventCardProps {
  event: Event;
}

const EventCard: React.FC<EventCardProps> = ({ event }) => {
  const getEventIcon = (type: string) => {
    switch (type) {
      case 'stock_price':
        return '📈';
      case 'sensor_reading':
        return '📡';
      case 'sports_score':
        return '⚽';
      default:
        return '📊';
    }
  };

  const getEventColor = (source: string) => {
    switch (source) {
      case 'stock_market':
        return 'bg-blue-100 text-blue-800';
      case 'iot_sensors':
        return 'bg-green-100 text-green-800';
      case 'sports_feed':
        return 'bg-orange-100 text-orange-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case 'high':
        return 'bg-red-100 text-red-800';
      case 'medium':
        return 'bg-yellow-100 text-yellow-800';
      case 'low':
        return 'bg-green-100 text-green-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatEventData = (data: any) => {
    if (data.price !== undefined) {
      return `$${data.price.toFixed(2)}`;
    }
    if (data.value !== undefined) {
      return `${data.value}${data.unit || ''}`;
    }
    return JSON.stringify(data, null, 2);
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.2 }}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="text-2xl">
            {getEventIcon(event.type)}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center space-x-2 mb-1">
              <h4 className="text-sm font-medium text-gray-900 truncate">
                {event.type.replace('_', ' ').toUpperCase()}
              </h4>
              <span className={`badge ${getEventColor(event.source)}`}>
                {event.source.replace('_', ' ')}
              </span>
              {event.metadata?.priority && (
                <span className={`badge ${getPriorityColor(event.metadata.priority)}`}>
                  {event.metadata.priority}
                </span>
              )}
            </div>

            <div className="text-sm text-gray-600 mb-2">
              {formatEventData(event.data)}
            </div>

            <div className="flex items-center space-x-4 text-xs text-gray-500">
              <span>{format(new Date(event.timestamp), 'HH:mm:ss')}</span>
              <span>ID: {event.id.slice(0, 8)}...</span>
              {event.metadata?.tags && event.metadata.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  <span>Tags:</span>
                  {event.metadata.tags.slice(0, 2).map((tag, index) => (
                    <span key={index} className="bg-gray-100 px-1 rounded text-xs">
                      {tag}
                    </span>
                  ))}
                  {event.metadata.tags.length > 2 && (
                    <span className="text-gray-400">+{event.metadata.tags.length - 2}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-gray-400 ml-2">
          {format(new Date(event.timestamp), 'MMM dd')}
        </div>
      </div>

      {Object.keys(event.data).length > 3 && (
        <details className="mt-3">
          <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">
            Show full data
          </summary>
          <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
            {JSON.stringify(event.data, null, 2)}
          </pre>
        </details>
      )}
    </motion.div>
  );
};

export default EventCard;

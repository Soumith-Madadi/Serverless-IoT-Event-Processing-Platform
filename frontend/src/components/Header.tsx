import React from 'react';
import { motion } from 'framer-motion';
import { 
  ChartBarIcon, 
  BoltIcon, 
  CogIcon,
  BellIcon,
  InformationCircleIcon,
  UserCircleIcon,
  ArrowRightOnRectangleIcon
} from '@heroicons/react/24/outline';
import { useWebSocketStore } from '../stores/websocketStore';
import { useEventStore } from '../stores/eventStore';
import { useAuth } from '../contexts/AuthContext';

const Header: React.FC = () => {
  const { isConnected, isConnecting, connect, disconnect } = useWebSocketStore();
  const { events, aggregation } = useEventStore();
  const { user, logout } = useAuth();

  const handleConnectionToggle = () => {
    if (isConnected) {
      disconnect();
    } else {
      connect();
    }
  };

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <div className="flex items-center space-x-4">
            <motion.div
              initial={{ scale: 0.8 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.3 }}
              className="flex items-center space-x-2"
            >
              <div className="w-8 h-8 bg-gradient-to-br from-primary-500 to-primary-700 rounded-lg flex items-center justify-center">
                <BoltIcon className="w-5 h-5 text-white" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">
                Event Platform
              </h1>
            </motion.div>
            
            <div className="hidden md:flex items-center space-x-1 text-sm text-gray-500">
              <span>•</span>
              <span>Real-time Event Processing</span>
              <span>•</span>
              <span>Serverless Architecture</span>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="hidden md:flex items-center space-x-6 text-sm">
              <div className="flex items-center space-x-2">
                <ChartBarIcon className="w-4 h-4 text-gray-400" />
                <span className="text-gray-600">
                  {events.length} events
                </span>
              </div>
              
              {aggregation && (
                <div className="flex items-center space-x-2">
                  <InformationCircleIcon className="w-4 h-4 text-gray-400" />
                  <span className="text-gray-600">
                    {Object.keys(aggregation.sources).length} sources
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <div className={`
                w-2 h-2 rounded-full
                ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-gray-300'}
              `} />
              <span className="text-sm font-medium text-gray-600">
                {isConnecting ? 'Connecting...' : isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>

            <button
              onClick={handleConnectionToggle}
              disabled={isConnecting}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                ${isConnected
                  ? 'bg-danger-100 text-danger-700 hover:bg-danger-200'
                  : 'bg-success-100 text-success-700 hover:bg-success-200'
                }
                ${isConnecting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
              `}
            >
              {isConnecting ? 'Connecting...' : isConnected ? 'Disconnect' : 'Connect'}
            </button>

            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <BellIcon className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-2 text-sm text-gray-700">
                <UserCircleIcon className="w-5 h-5 text-gray-400" />
                <span className="hidden md:block font-medium">
                  {user?.firstName || user?.username}
                </span>
              </div>
              
              <button
                onClick={logout}
                className="flex items-center space-x-1 px-3 py-1.5 rounded-lg text-sm font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
                title="Logout"
              >
                <ArrowRightOnRectangleIcon className="w-4 h-4" />
                <span className="hidden md:block">Logout</span>
              </button>
            </div>

            <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
              <CogIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;

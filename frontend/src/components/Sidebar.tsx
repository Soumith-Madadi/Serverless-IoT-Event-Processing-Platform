import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  HomeIcon,
  ChartBarIcon,
  ClockIcon,
  CogIcon,
  BoltIcon,
  ServerIcon,
  DevicePhoneMobileIcon,
  BellIcon,
  CommandLineIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Devices', href: '/devices', icon: DevicePhoneMobileIcon },
  { name: 'Alerts', href: '/alerts', icon: BellIcon },
  { name: 'Commands', href: '/commands', icon: CommandLineIcon },
  { name: 'Events', href: '/events', icon: ChartBarIcon },
  { name: 'Replay', href: '/replay', icon: ClockIcon },
  { name: 'Settings', href: '/settings', icon: CogIcon },
];

const Sidebar: React.FC = () => {
  const location = useLocation();

  return (
    <div className="w-64 bg-white shadow-sm border-r border-gray-200 min-h-screen">
      <div className="p-6">
        <nav className="space-y-2">
          {navigation.map((item) => {
            const isActive = location.pathname === item.href;
            
            return (
              <NavLink
                key={item.name}
                to={item.href}
                className={({ isActive }) => `
                  flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors
                  ${isActive
                    ? 'bg-primary-50 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }
                `}
              >
                <item.icon className="w-5 h-5" />
                <span>{item.name}</span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 w-1 h-8 bg-primary-600 rounded-r"
                    initial={false}
                    transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  />
                )}
              </NavLink>
            );
          })}
        </nav>

        <div className="my-6 border-t border-gray-200" />

        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            System Status
          </h3>
          
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <BoltIcon className="w-4 h-4 text-success-500" />
                <span className="text-gray-600">Event Processing</span>
              </div>
              <span className="text-success-600 font-medium">Active</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <ServerIcon className="w-4 h-4 text-success-500" />
                <span className="text-gray-600">API Gateway</span>
              </div>
              <span className="text-success-600 font-medium">Online</span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-2">
                <ServerIcon className="w-4 h-4 text-success-500" />
                <span className="text-gray-600">Database</span>
              </div>
              <span className="text-success-600 font-medium">Connected</span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-4">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Quick Actions
          </h3>
          
          <div className="space-y-2">
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors">
              Clear Events
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors">
              Export Data
            </button>
            <button className="w-full text-left px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 rounded-lg transition-colors">
              View Logs
            </button>
          </div>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <div className="text-xs text-gray-500">
            <p>IoT Platform v2.0.0</p>
            <p className="mt-1">Serverless Architecture</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;

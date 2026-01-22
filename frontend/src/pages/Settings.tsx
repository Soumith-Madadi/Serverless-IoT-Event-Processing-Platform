import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  CogIcon,
  WifiIcon,
  ServerIcon,
  BellIcon,
  ShieldCheckIcon 
} from '@heroicons/react/24/outline';
import { useWebSocketStore } from '../stores/websocketStore';

const Settings: React.FC = () => {
  const { isConnected, connect, disconnect } = useWebSocketStore();
  
  const [websocketUrl, setWebsocketUrl] = useState('wss://dhdivm4hw7.execute-api.us-east-1.amazonaws.com/dev');
  const [autoConnect, setAutoConnect] = useState(true);
  const [notifications, setNotifications] = useState(true);
  const [theme, setTheme] = useState('light');
  const [refreshInterval, setRefreshInterval] = useState(5000);

  const handleSaveSettings = () => {
    localStorage.setItem('websocketUrl', websocketUrl);
    localStorage.setItem('autoConnect', autoConnect.toString());
    localStorage.setItem('notifications', notifications.toString());
    localStorage.setItem('theme', theme);
    localStorage.setItem('refreshInterval', refreshInterval.toString());
    
    alert('Settings saved successfully!');
  };

  const handleTestConnection = async () => {
    try {
      await connect(websocketUrl);
      alert('Connection test successful!');
    } catch (error) {
      alert('Connection test failed: ' + error);
    }
  };

  const handleResetSettings = () => {
    if (window.confirm('Are you sure you want to reset all settings to default?')) {
      setWebsocketUrl('wss://dhdivm4hw7.execute-api.us-east-1.amazonaws.com/dev');
      setAutoConnect(true);
      setNotifications(true);
      setTheme('light');
      setRefreshInterval(5000);
      
      localStorage.clear();
      alert('Settings reset to default!');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-gray-600">Configure your event platform preferences</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button
            onClick={handleSaveSettings}
            className="btn btn-primary"
          >
            Save Settings
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="card"
        >
          <div className="flex items-center space-x-2 mb-4">
            <WifiIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Connection</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                WebSocket URL
              </label>
              <input
                type="text"
                value={websocketUrl}
                onChange={(e) => setWebsocketUrl(e.target.value)}
                className="input"
                placeholder="wss://dhdivm4hw7.execute-api.us-east-1.amazonaws.com/dev"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="autoConnect"
                checked={autoConnect}
                onChange={(e) => setAutoConnect(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="autoConnect" className="text-sm text-gray-700">
                Auto-connect on startup
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className={`
                w-2 h-2 rounded-full
                ${isConnected ? 'bg-success-500' : 'bg-gray-300'}
              `} />
              <span className="text-sm text-gray-600">
                Status: {isConnected ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={handleTestConnection}
                className="btn btn-secondary flex-1"
              >
                Test Connection
              </button>
              {isConnected ? (
                <button
                  onClick={disconnect}
                  className="btn btn-danger flex-1"
                >
                  Disconnect
                </button>
              ) : (
                <button
                  onClick={() => connect(websocketUrl)}
                  className="btn btn-success flex-1"
                >
                  Connect
                </button>
              )}
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.1 }}
          className="card"
        >
          <div className="flex items-center space-x-2 mb-4">
            <CogIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Display</h3>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Theme
              </label>
              <select
                value={theme}
                onChange={(e) => setTheme(e.target.value)}
                className="input"
              >
                <option value="light">Light</option>
                <option value="dark">Dark</option>
                <option value="auto">Auto</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Refresh Interval (ms)
              </label>
              <input
                type="number"
                value={refreshInterval}
                onChange={(e) => setRefreshInterval(parseInt(e.target.value))}
                className="input"
                min="1000"
                max="30000"
                step="1000"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="notifications"
                checked={notifications}
                onChange={(e) => setNotifications(e.target.checked)}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="notifications" className="text-sm text-gray-700">
                Enable notifications
              </label>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.2 }}
          className="card"
        >
          <div className="flex items-center space-x-2 mb-4">
            <ServerIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">System Info</h3>
          </div>
          
          <div className="space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Platform Version</span>
              <span className="font-medium">1.0.0</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">React Version</span>
              <span className="font-medium">18.2.0</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Node.js Version</span>
              <span className="font-medium">18.x</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Build Date</span>
              <span className="font-medium">{new Date().toLocaleDateString()}</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.3 }}
          className="card"
        >
          <div className="flex items-center space-x-2 mb-4">
                            <ServerIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Data Management</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Local Storage</span>
              <span className="font-medium">2.3 MB</span>
            </div>
            
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Events Cached</span>
              <span className="font-medium">1,247</span>
            </div>
            
            <div className="flex space-x-2">
              <button className="btn btn-secondary flex-1">
                Clear Cache
              </button>
              <button className="btn btn-secondary flex-1">
                Export Data
              </button>
            </div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
          className="card"
        >
          <div className="flex items-center space-x-2 mb-4">
            <ShieldCheckIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Security</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="ssl"
                defaultChecked
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="ssl" className="text-sm text-gray-700">
                Require SSL/TLS
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="auth"
                defaultChecked
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="auth" className="text-sm text-gray-700">
                Enable authentication
              </label>
            </div>
            
            <button className="btn btn-secondary w-full">
              Change API Keys
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="card"
        >
          <div className="flex items-center space-x-2 mb-4">
            <BellIcon className="w-5 h-5 text-primary-600" />
            <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="connectionAlerts"
                defaultChecked
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="connectionAlerts" className="text-sm text-gray-700">
                Connection alerts
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="errorAlerts"
                defaultChecked
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="errorAlerts" className="text-sm text-gray-700">
                Error alerts
              </label>
            </div>
            
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="eventAlerts"
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <label htmlFor="eventAlerts" className="text-sm text-gray-700">
                High-priority event alerts
              </label>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, delay: 0.6 }}
        className="flex justify-between items-center pt-6 border-t border-gray-200"
      >
        <button
          onClick={handleResetSettings}
          className="btn btn-danger"
        >
          Reset to Default
        </button>
        
        <div className="flex space-x-3">
          <button className="btn btn-secondary">
            Export Settings
          </button>
          <button className="btn btn-primary">
            Save All Changes
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default Settings;

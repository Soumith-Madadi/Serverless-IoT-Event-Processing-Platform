import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useCommandStore } from '../stores/commandStore';
import { useDeviceStore } from '../stores/deviceStore';
import { format } from 'date-fns';

const Commands: React.FC = () => {
  const { commands, isLoading, error, fetchCommandHistory, sendCommand } = useCommandStore();
  const { devices, fetchDevices } = useDeviceStore();
  const [selectedDevice, setSelectedDevice] = useState<string>('');
  const [commandType, setCommandType] = useState('control');
  const [commandName, setCommandName] = useState('status');

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  useEffect(() => {
    if (selectedDevice) {
      fetchCommandHistory(selectedDevice);
    }
  }, [selectedDevice, fetchCommandHistory]);

  const handleSendCommand = async () => {
    if (!selectedDevice) {
      alert('Please select a device');
      return;
    }
    try {
      await sendCommand(selectedDevice, commandType, commandName);
      alert('Command sent successfully');
      fetchCommandHistory(selectedDevice);
    } catch (error) {
      alert('Failed to send command: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-blue-100 text-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Commands</h1>
          <p className="text-gray-600">Send commands to IoT devices</p>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <span className="text-red-800">Error: {error}</span>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Send Command</h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Device</label>
              <select
                value={selectedDevice}
                onChange={(e) => setSelectedDevice(e.target.value)}
                className="input"
              >
                <option value="">Select a device</option>
                {devices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.name} ({device.deviceId})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Command Type</label>
              <select
                value={commandType}
                onChange={(e) => setCommandType(e.target.value)}
                className="input"
              >
                <option value="control">Control</option>
                <option value="configuration">Configuration</option>
                <option value="firmware">Firmware</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Command Name</label>
              <select
                value={commandName}
                onChange={(e) => setCommandName(e.target.value)}
                className="input"
              >
                <option value="status">Get Status</option>
                <option value="reboot">Reboot</option>
                <option value="reset">Reset</option>
                <option value="configure">Configure</option>
              </select>
            </div>
            <button
              onClick={handleSendCommand}
              disabled={!selectedDevice || isLoading}
              className="btn btn-primary w-full"
            >
              {isLoading ? 'Sending...' : 'Send Command'}
            </button>
          </div>
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Command History</h3>
          {!selectedDevice ? (
            <div className="text-center py-8">
              <p className="text-gray-500">Select a device to view command history</p>
            </div>
          ) : isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading commands...</div>
            </div>
          ) : commands.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No commands sent to this device</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {commands.map((command) => (
                <motion.div
                  key={command.commandId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="font-medium text-gray-900">{command.commandName}</h4>
                      <p className="text-sm text-gray-600">{command.commandType}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${getStatusColor(command.status)}`}>
                      {command.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500">
                    {format(new Date(command.timestamp), 'MMM dd, yyyy HH:mm:ss')}
                  </p>
                  {command.errorMessage && (
                    <p className="text-xs text-red-600 mt-2">Error: {command.errorMessage}</p>
                  )}
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Commands;

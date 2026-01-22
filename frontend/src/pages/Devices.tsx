import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useDeviceStore } from '../stores/deviceStore';
import { useCommandStore } from '../stores/commandStore';
import { PlusIcon, TrashIcon, CommandLineIcon, XMarkIcon } from '@heroicons/react/24/outline';

const Devices: React.FC = () => {
  const { devices, isLoading, error, fetchDevices, deactivateDevice, setSelectedDevice, registerDevice } = useDeviceStore();
  const { sendCommand } = useCommandStore();
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: '',
    model: '',
    manufacturer: '',
    deviceId: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchDevices();
  }, [fetchDevices]);

  const handleDeactivate = async (deviceId: string) => {
    if (window.confirm('Are you sure you want to deactivate this device?')) {
      await deactivateDevice(deviceId);
      fetchDevices();
    }
  };

  const handleSendCommand = async (deviceId: string, commandName: string) => {
    try {
      await sendCommand(deviceId, 'control', commandName);
      alert('Command sent successfully');
    } catch (error) {
      alert('Failed to send command: ' + (error instanceof Error ? error.message : 'Unknown error'));
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.type.trim()) {
      alert('Please fill in at least name and type fields');
      return;
    }

    try {
      setIsSubmitting(true);
      // Generate deviceId if not provided
      const deviceId = formData.deviceId.trim() || crypto.randomUUID();
      
      await registerDevice({
        deviceId,
        name: formData.name.trim(),
        type: formData.type.trim(),
        model: formData.model.trim() || undefined,
        manufacturer: formData.manufacturer.trim() || undefined,
        status: 'active',
      });
      
      // Reset form and close
      setFormData({
        name: '',
        type: '',
        model: '',
        manufacturer: '',
        deviceId: '',
      });
      setShowRegisterForm(false);
      await fetchDevices();
      alert('Device registered successfully!');
    } catch (error) {
      alert('Failed to register device: ' + (error instanceof Error ? error.message : 'Unknown error'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Devices</h1>
          <p className="text-gray-600">Manage your IoT devices</p>
        </div>
        <button
          onClick={() => setShowRegisterForm(!showRegisterForm)}
          className="btn btn-primary flex items-center space-x-2"
        >
          <PlusIcon className="w-5 h-5" />
          <span>Register Device</span>
        </button>
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

      {showRegisterForm && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="card"
        >
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-bold text-gray-900">Register New Device</h2>
            <button
              onClick={() => {
                setShowRegisterForm(false);
                setFormData({
                  name: '',
                  type: '',
                  model: '',
                  manufacturer: '',
                  deviceId: '',
                });
              }}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <XMarkIcon className="w-6 h-6" />
            </button>
          </div>

          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            <div>
              <label htmlFor="deviceId" className="block text-sm font-medium text-gray-700 mb-2">
                Device ID (optional - will be auto-generated if empty)
              </label>
              <input
                id="deviceId"
                type="text"
                value={formData.deviceId}
                onChange={(e) => handleInputChange('deviceId', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="Leave empty to auto-generate"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                Device Name *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="Enter device name"
                required
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="type" className="block text-sm font-medium text-gray-700 mb-2">
                Device Type *
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) => handleInputChange('type', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                required
                disabled={isSubmitting}
              >
                <option value="">Select device type</option>
                <option value="sensor">Sensor</option>
                <option value="actuator">Actuator</option>
                <option value="gateway">Gateway</option>
                <option value="controller">Controller</option>
                <option value="monitor">Monitor</option>
                <option value="switch">Switch</option>
                <option value="camera">Camera</option>
                <option value="thermostat">Thermostat</option>
                <option value="light">Light</option>
                <option value="lock">Lock</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div>
              <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-2">
                Model (optional)
              </label>
              <input
                id="model"
                type="text"
                value={formData.model}
                onChange={(e) => handleInputChange('model', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="Enter device model"
                disabled={isSubmitting}
              />
            </div>

            <div>
              <label htmlFor="manufacturer" className="block text-sm font-medium text-gray-700 mb-2">
                Manufacturer (optional)
              </label>
              <input
                id="manufacturer"
                type="text"
                value={formData.manufacturer}
                onChange={(e) => handleInputChange('manufacturer', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                placeholder="Enter manufacturer name"
                disabled={isSubmitting}
              />
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                disabled={isSubmitting || !formData.name.trim() || !formData.type.trim()}
                className="flex-1 btn btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Registering...' : 'Register Device'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowRegisterForm(false);
                  setFormData({
                    name: '',
                    type: '',
                    model: '',
                    manufacturer: '',
                    deviceId: '',
                  });
                }}
                className="btn btn-secondary"
                disabled={isSubmitting}
              >
                Cancel
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-gray-500">Loading devices...</div>
        </div>
      ) : devices.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-gray-400 text-6xl mb-4">📱</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No devices registered</h3>
          <p className="text-gray-600">Register your first IoT device to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {devices.map((device, index) => (
            <motion.div
              key={device.deviceId}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="card cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => setSelectedDevice(device)}
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{device.name}</h3>
                  <p className="text-sm text-gray-500">{device.deviceId}</p>
                </div>
                <span className={`px-2 py-1 rounded text-xs font-medium ${
                  device.status === 'active' ? 'bg-green-100 text-green-800' :
                  device.status === 'offline' ? 'bg-gray-100 text-gray-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {device.status}
                </span>
              </div>

              <div className="space-y-2 mb-4">
                <div className="text-sm">
                  <span className="text-gray-600">Type: </span>
                  <span className="font-medium">{device.type}</span>
                </div>
                {device.model && (
                  <div className="text-sm">
                    <span className="text-gray-600">Model: </span>
                    <span className="font-medium">{device.model}</span>
                  </div>
                )}
                {device.batteryLevel !== undefined && (
                  <div className="text-sm">
                    <span className="text-gray-600">Battery: </span>
                    <span className="font-medium">{device.batteryLevel}%</span>
                  </div>
                )}
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSendCommand(device.deviceId, 'status');
                  }}
                  className="flex-1 btn btn-secondary text-sm flex items-center justify-center space-x-1"
                >
                  <CommandLineIcon className="w-4 h-4" />
                  <span>Command</span>
                </button>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeactivate(device.deviceId);
                  }}
                  className="btn btn-danger text-sm flex items-center justify-center"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Devices;

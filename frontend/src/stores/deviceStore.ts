import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Device {
  deviceId: string;
  name: string;
  type: string;
  model?: string;
  manufacturer?: string;
  location?: {
    latitude: number;
    longitude: number;
    altitude?: number;
  };
  capabilities?: {
    sensors?: string[];
    actuators?: string[];
    commands?: string[];
  };
  status: 'active' | 'inactive' | 'maintenance' | 'offline';
  ownerId?: string;
  userId?: string;
  registrationDate: number;
  lastSeen?: number;
  firmwareVersion?: string;
  batteryLevel?: number;
  signalStrength?: number;
}

interface DeviceStore {
  devices: Device[];
  selectedDevice: Device | null;
  isLoading: boolean;
  error: string | null;
  fetchDevices: () => Promise<void>;
  fetchDevice: (deviceId: string) => Promise<void>;
  registerDevice: (device: Partial<Device>) => Promise<void>;
  updateDevice: (deviceId: string, updates: Partial<Device>) => Promise<void>;
  deactivateDevice: (deviceId: string) => Promise<void>;
  setSelectedDevice: (device: Device | null) => void;
}

const API_URL = process.env.REACT_APP_API_URL || 'https://ev7csp39fc.execute-api.us-east-1.amazonaws.com/dev';

export const useDeviceStore = create<DeviceStore>()(
  devtools(
    (set, get) => ({
      devices: [],
      selectedDevice: null,
      isLoading: false,
      error: null,

      fetchDevices: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/devices`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch devices');
          const data = await response.json();
          set({ devices: data.devices || [], isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
        }
      },

      fetchDevice: async (deviceId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/devices/${deviceId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch device');
          const device = await response.json();
          set({ selectedDevice: device, isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
        }
      },

      registerDevice: async (device: Partial<Device>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/devices`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(device),
          });
          if (!response.ok) throw new Error('Failed to register device');
          const newDevice = await response.json();
          set(state => ({
            devices: [...state.devices, newDevice.device],
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
          throw error;
        }
      },

      updateDevice: async (deviceId: string, updates: Partial<Device>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/devices/${deviceId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(updates),
          });
          if (!response.ok) throw new Error('Failed to update device');
          const updated = await response.json();
          set(state => ({
            devices: state.devices.map(d => d.deviceId === deviceId ? updated.device : d),
            selectedDevice: state.selectedDevice?.deviceId === deviceId ? updated.device : state.selectedDevice,
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
          throw error;
        }
      },

      deactivateDevice: async (deviceId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/devices/${deviceId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to deactivate device');
          set(state => ({
            devices: state.devices.map(d => d.deviceId === deviceId ? { ...d, status: 'inactive' as const } : d),
            selectedDevice: state.selectedDevice?.deviceId === deviceId ? null : state.selectedDevice,
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
          throw error;
        }
      },

      setSelectedDevice: (device: Device | null) => {
        set({ selectedDevice: device });
      },
    }),
    { name: 'DeviceStore' }
  )
);

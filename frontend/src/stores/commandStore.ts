import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface DeviceCommand {
  commandId: string;
  deviceId: string;
  commandType: string;
  commandName: string;
  parameters?: Record<string, any>;
  status: 'pending' | 'sent' | 'acknowledged' | 'completed' | 'failed';
  timestamp: number;
  sentAt?: number;
  acknowledgedAt?: number;
  completedAt?: number;
  failedAt?: number;
  errorMessage?: string;
  userId?: string;
}

interface CommandStore {
  commands: DeviceCommand[];
  isLoading: boolean;
  error: string | null;
  sendCommand: (deviceId: string, commandType: string, commandName: string, parameters?: Record<string, any>) => Promise<void>;
  fetchCommandHistory: (deviceId: string) => Promise<void>;
  clearCommands: () => void;
}

const API_URL = process.env.REACT_APP_API_URL || 'https://ev7csp39fc.execute-api.us-east-1.amazonaws.com/dev';

export const useCommandStore = create<CommandStore>()(
  devtools(
    (set, get) => ({
      commands: [],
      isLoading: false,
      error: null,

      sendCommand: async (deviceId: string, commandType: string, commandName: string, parameters?: Record<string, any>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/devices/${deviceId}/commands`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify({
              commandType,
              commandName,
              parameters,
            }),
          });
          if (!response.ok) throw new Error('Failed to send command');
          const data = await response.json();
          set(state => ({
            commands: [data.command, ...state.commands],
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
          throw error;
        }
      },

      fetchCommandHistory: async (deviceId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/devices/${deviceId}/commands`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch command history');
          const data = await response.json();
          set({ commands: data.commands || [], isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
        }
      },

      clearCommands: () => {
        set({ commands: [] });
      },
    }),
    { name: 'CommandStore' }
  )
);

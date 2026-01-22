import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Metrics {
  totalEvents: number;
  recentEvents: number;
  activeDevices?: number;
  lastHour: {
    iotSensors: number;
    iotDevices?: number;
    sensorReadings: number;
    deviceStatus?: number;
    commands?: number;
    alerts?: number;
  };
  timeWindows: {
    fifteenMinutes: number;
    oneHour: number;
    twentyFourHours: number;
    currentTime: number;
  };
  sources: string[];
  eventTypes: string[];
}

interface MetricsState {
  metrics: Metrics | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  
  fetchMetrics: () => Promise<void>;
  setMetrics: (metrics: Metrics) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const API_BASE_URL = 'https://ev7csp39fc.execute-api.us-east-1.amazonaws.com/dev';

export const useMetricsStore = create<MetricsState>()(
  devtools((set, get) => ({
    metrics: null,
    isLoading: false,
    error: null,
    lastUpdated: null,

    fetchMetrics: async () => {
      set({ isLoading: true, error: null });

      try {
        const response = await fetch(`${API_BASE_URL}/metrics`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const metrics: Metrics = await response.json();
        
        set({
          metrics,
          isLoading: false,
          lastUpdated: Date.now(),
          error: null,
        });
        
        console.log('Metrics fetched successfully:', metrics);
        
      } catch (error) {
        console.error('Error fetching metrics:', error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch metrics',
        });
      }
    },

    setMetrics: (metrics: Metrics) => {
      set({ metrics, lastUpdated: Date.now() });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    },
  }))
);

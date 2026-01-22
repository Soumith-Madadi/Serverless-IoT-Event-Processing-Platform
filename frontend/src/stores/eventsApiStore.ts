import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface Event {
  id: string;
  timestamp: number;
  source: string;
  type: string;
  data: any;
  metadata?: any;
  createdAt: number;
  updatedAt: number;
}

interface EventsApiState {
  events: Event[];
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  totalCount: number;
  
  fetchEvents: (limit?: number, startTime?: number, endTime?: number) => Promise<void>;
  fetchEventsBySource: (source: string, limit?: number) => Promise<void>;
  fetchEventsByType: (type: string, limit?: number) => Promise<void>;
  setEvents: (events: Event[]) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  clearEvents: () => void;
}

const API_BASE_URL = 'https://ev7csp39fc.execute-api.us-east-1.amazonaws.com/dev';

export const useEventsApiStore = create<EventsApiState>()(
  devtools((set, get) => ({
    events: [],
    isLoading: false,
    error: null,
    lastUpdated: null,
    totalCount: 0,

    fetchEvents: async (limit = 100, startTime?: number, endTime?: number) => {
      set({ isLoading: true, error: null });

      try {
        // Build query parameters
        const queryParams = new URLSearchParams();
        queryParams.append('limit', limit.toString());
        if (startTime) queryParams.append('startTime', startTime.toString());
        if (endTime) queryParams.append('endTime', endTime.toString());
        
        const response = await fetch(`${API_BASE_URL}/events?${queryParams.toString()}`);
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        set({
          events: data.events || [],
          isLoading: false,
          lastUpdated: Date.now(),
          totalCount: data.count || 0,
          error: null,
        });
        
        console.log(`Fetched ${data.events?.length || 0} events from API`);
        
      } catch (error) {
        console.error('Error fetching events:', error);
        set({
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to fetch events',
        });
      }
    },

    fetchEventsBySource: async (source: string, limit = 100) => {
      const { events } = get();
      const filteredEvents = events.filter(e => e.source === source).slice(0, limit);
      set({ events: filteredEvents });
    },

    fetchEventsByType: async (type: string, limit = 100) => {
      const { events } = get();
      const filteredEvents = events.filter(e => e.type === type).slice(0, limit);
      set({ events: filteredEvents });
    },

    setEvents: (events: Event[]) => {
      set({ events, lastUpdated: Date.now() });
    },

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    },

    clearEvents: () => {
      set({ events: [], totalCount: 0 });
    },
  }))
);

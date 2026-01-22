import { create } from 'zustand';
import { devtools, subscribeWithSelector } from 'zustand/middleware';

export interface Event {
  id: string;
  timestamp: number;
  source: string;
  type: string;
  data: Record<string, any>;
  metadata?: {
    version: string;
    tags?: string[];
    priority?: 'low' | 'medium' | 'high';
    correlationId?: string;
    userId?: string;
  };
}

export interface EventFilters {
  sources?: string[];
  types?: string[];
  startTime?: number;
  endTime?: number;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export interface EventAggregation {
  count: number;
  sources: Record<string, number>;
  types: Record<string, number>;
  timeRange: {
    start: number;
    end: number;
  };
}

interface EventState {
  events: Event[];
  filteredEvents: Event[];
  filters: EventFilters;
  aggregation: EventAggregation | null;
  isLoading: boolean;
  error: string | null;
  
  addEvent: (event: Event) => void;
  addEvents: (events: Event[]) => void;
  clearEvents: () => void;
  setFilters: (filters: EventFilters) => void;
  clearFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  updateAggregation: () => void;
  getEventsBySource: (source: string) => Event[];
  getEventsByType: (type: string) => Event[];
  getEventsByTimeRange: (startTime: number, endTime: number) => Event[];
  getLatestEvents: (count: number) => Event[];
}

export const useEventStore = create<EventState>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      events: [],
      filteredEvents: [],
      filters: {},
      aggregation: null,
      isLoading: false,
      error: null,

      addEvent: (event: Event) => {
        set((state) => {
          const newEvents = [event, ...state.events].slice(0, 1000); // Keep last 1000 events
          const filteredEvents = applyFilters(newEvents, state.filters);
          
          return {
            events: newEvents,
            filteredEvents,
          };
        });
        
        get().updateAggregation();
      },

      addEvents: (events: Event[]) => {
        set((state) => {
          const newEvents = [...events, ...state.events].slice(0, 1000);
          const filteredEvents = applyFilters(newEvents, state.filters);
          
          return {
            events: newEvents,
            filteredEvents,
          };
        });
        
        get().updateAggregation();
      },

      clearEvents: () => {
        set({
          events: [],
          filteredEvents: [],
          aggregation: null,
        });
      },

      setFilters: (filters: EventFilters) => {
        set((state) => {
          const newFilters = { ...state.filters, ...filters };
          const filteredEvents = applyFilters(state.events, newFilters);
          
          return {
            filters: newFilters,
            filteredEvents,
          };
        });
        
        get().updateAggregation();
      },

      clearFilters: () => {
        set((state) => ({
          filters: {},
          filteredEvents: state.events,
        }));
        
        get().updateAggregation();
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },

      setError: (error: string | null) => {
        set({ error });
      },

      updateAggregation: () => {
        const { events } = get();
        
        if (events.length === 0) {
          set({ aggregation: null });
          return;
        }

        const sources: Record<string, number> = {};
        const types: Record<string, number> = {};
        
        events.forEach(event => {
          sources[event.source] = (sources[event.source] || 0) + 1;
          types[event.type] = (types[event.type] || 0) + 1;
        });

        const timestamps = events.map(e => e.timestamp);
        const timeRange = {
          start: Math.min(...timestamps),
          end: Math.max(...timestamps),
        };

        set({
          aggregation: {
            count: events.length,
            sources,
            types,
            timeRange,
          },
        });
      },

      getEventsBySource: (source: string) => {
        return get().events.filter(event => event.source === source);
      },

      getEventsByType: (type: string) => {
        return get().events.filter(event => event.type === type);
      },

      getEventsByTimeRange: (startTime: number, endTime: number) => {
        return get().events.filter(
          event => event.timestamp >= startTime && event.timestamp <= endTime
        );
      },

      getLatestEvents: (count: number) => {
        return get().events.slice(0, count);
      },
    })),
    {
      name: 'event-store',
    }
  )
);

function applyFilters(events: Event[], filters: EventFilters): Event[] {
  let filtered = events;

  if (filters.sources && filters.sources.length > 0) {
    filtered = filtered.filter(event => filters.sources!.includes(event.source));
  }

  if (filters.types && filters.types.length > 0) {
    filtered = filtered.filter(event => filters.types!.includes(event.type));
  }

  if (filters.startTime) {
    filtered = filtered.filter(event => event.timestamp >= filters.startTime!);
  }

  if (filters.endTime) {
    filtered = filtered.filter(event => event.timestamp <= filters.endTime!);
  }

  if (filters.tags && filters.tags.length > 0) {
    filtered = filtered.filter(event => 
      event.metadata?.tags?.some(tag => filters.tags!.includes(tag))
    );
  }

  if (filters.limit) {
    filtered = filtered.slice(0, filters.limit);
  }

  return filtered;
}

export const useEvents = () => useEventStore(state => state.events);
export const useFilteredEvents = () => useEventStore(state => state.filteredEvents);
export const useEventFilters = () => useEventStore(state => state.filters);
export const useEventAggregation = () => useEventStore(state => state.aggregation);
export const useEventLoading = () => useEventStore(state => state.isLoading);
export const useEventError = () => useEventStore(state => state.error);

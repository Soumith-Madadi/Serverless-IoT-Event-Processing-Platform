import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import toast from 'react-hot-toast';

export interface WebSocketMessage {
  action: string;
  data?: any;
  error?: string;
  requestId?: string;
  timestamp: number;
}

export interface ReplayConfig {
  startTime: number;
  endTime: number;
  speed: number;
  filters?: {
    sources?: string[];
    types?: string[];
    tags?: string[];
  };
}

interface WebSocketState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionId: string | null;
  subscriptions: string[];
  replayConfig: ReplayConfig | null;
  isReplaying: boolean;
  error: string | null;
  lastMessage: WebSocketMessage | null;
  
  socket: WebSocket | null;
  
  connect: (url?: string) => Promise<void>;
  disconnect: () => void;
  sendMessage: (message: any) => void;
  subscribe: (sources?: string[], types?: string[]) => void;
  unsubscribe: (sources?: string[], types?: string[]) => void;
  startReplay: (config: ReplayConfig) => void;
  stopReplay: () => void;
  setError: (error: string | null) => void;
  clearError: () => void;
}

const DEFAULT_WEBSOCKET_URL = process.env.REACT_APP_WEBSOCKET_URL || 'wss://dhdivm4hw7.execute-api.us-east-1.amazonaws.com/dev';

export const useWebSocketStore = create<WebSocketState>()(
  devtools((set, get) => ({
    isConnected: false,
    isConnecting: false,
    connectionId: null,
    subscriptions: [],
    replayConfig: null,
    isReplaying: false,
    error: null,
    lastMessage: null,
    socket: null,

    connect: async (url = DEFAULT_WEBSOCKET_URL) => {
      const { socket, isConnected } = get();
      
      if (socket && isConnected) {
        console.log('WebSocket already connected');
        return;
      }

      set({ isConnecting: true, error: null });

      try {
        const ws = new WebSocket(url);

        ws.onopen = () => {
          console.log('WebSocket connected');
          set({
            isConnected: true,
            isConnecting: false,
            socket: ws,
            error: null,
          });
          
          toast.success('Connected to event stream');
        };

        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);
            console.log('WebSocket message received:', message);
            
            set({ lastMessage: message });
            
            handleWebSocketMessage(message);
            
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
            set({ error: 'Failed to parse message' });
          }
        };

        ws.onclose = (event) => {
          console.log('WebSocket disconnected:', event.code, event.reason);
          set({
            isConnected: false,
            isConnecting: false,
            socket: null,
            connectionId: null,
            subscriptions: [],
            replayConfig: null,
            isReplaying: false,
          });
          
          toast.error('Disconnected from event stream');
          
          setTimeout(() => {
            const { isConnected } = get();
            if (!isConnected) {
              get().connect(url);
            }
          }, 5000);
        };

        ws.onerror = (error) => {
          console.error('WebSocket error:', error);
          set({
            isConnected: false,
            isConnecting: false,
            socket: null,
            error: 'WebSocket connection failed',
          });
          
          toast.error('WebSocket connection failed');
        };

      } catch (error) {
        console.error('Failed to create WebSocket connection:', error);
        set({
          isConnected: false,
          isConnecting: false,
          socket: null,
          error: 'Failed to create connection',
        });
        
        toast.error('Failed to create WebSocket connection');
      }
    },

    disconnect: () => {
      const { socket } = get();
      
      if (socket) {
        socket.close();
      }
      
      set({
        isConnected: false,
        isConnecting: false,
        socket: null,
        connectionId: null,
        subscriptions: [],
        replayConfig: null,
        isReplaying: false,
      });
    },

    sendMessage: (message: any) => {
      const { socket, isConnected } = get();
      
      if (!socket || !isConnected) {
        console.error('WebSocket not connected');
        set({ error: 'WebSocket not connected' });
        return;
      }

      try {
        const messageWithTimestamp = {
          ...message,
          timestamp: Date.now(),
        };
        
        socket.send(JSON.stringify(messageWithTimestamp));
        console.log('Message sent:', messageWithTimestamp);
        
      } catch (error) {
        console.error('Failed to send message:', error);
        set({ error: 'Failed to send message' });
      }
    },

    subscribe: (sources?: string[], types?: string[]) => {
      const message = {
        action: 'subscribe',
        data: {
          sources: sources || [],
          types: types || [],
        },
      };
      
      get().sendMessage(message);
      
      set((state) => ({
        subscriptions: Array.from(new Set([...state.subscriptions, ...(sources || []), ...(types || [])])),
      }));
    },

    unsubscribe: (sources?: string[], types?: string[]) => {
      const message = {
        action: 'unsubscribe',
        data: {
          sources: sources || [],
          types: types || [],
        },
      };
      
      get().sendMessage(message);
      
      set((state) => ({
        subscriptions: state.subscriptions.filter(
          sub => ![...(sources || []), ...(types || [])].includes(sub)
        ),
      }));
    },

    startReplay: (config: ReplayConfig) => {
      const message = {
        action: 'start_replay',
        data: config,
      };
      
      get().sendMessage(message);
      
      set({
        replayConfig: config,
        isReplaying: true,
      });
      
      toast.success('Replay started');
    },

    stopReplay: () => {
      const message = {
        action: 'stop_replay',
      };
      
      get().sendMessage(message);
      
      set({
        replayConfig: null,
        isReplaying: false,
      });
      
      toast.success('Replay stopped');
    },

    setError: (error: string | null) => {
      set({ error });
    },

    clearError: () => {
      set({ error: null });
    },
  }), {
    name: 'websocket-store',
  })
);

function handleWebSocketMessage(message: WebSocketMessage) {
  const { action, data, error } = message;

  if (error) {
    console.error('WebSocket error message:', error);
    toast.error(`WebSocket error: ${error}`);
    return;
  }

  switch (action) {
    case 'event':
      if (data) {
        const { useEventStore } = require('./eventStore');
        const { addEvent } = useEventStore.getState();
        addEvent(data);
      }
      break;

    case 'replay_event':
      if (data) {
        const { useEventStore } = require('./eventStore');
        const { addEvent } = useEventStore.getState();
        addEvent(data);
      }
      break;

    case 'subscribe':
      if (data?.subscribed) {
        console.log('Subscribed to:', data.subscribed);
        toast.success(`Subscribed to: ${data.subscribed.join(', ')}`);
      }
      break;

    case 'unsubscribe':
      if (data?.subscribed) {
        console.log('Unsubscribed from:', data.subscribed);
        toast.success(`Unsubscribed from: ${data.subscribed.join(', ')}`);
      }
      break;

    case 'start_replay':
      if (data?.message) {
        console.log('Replay started:', data.message);
      }
      break;

    case 'stop_replay':
      if (data?.message) {
        console.log('Replay stopped:', data.message);
      }
      break;

    case 'pong':
      console.log('Received pong');
      break;

    default:
      console.log('Unknown WebSocket message action:', action);
  }
}

if (typeof window !== 'undefined') {
  setTimeout(() => {
    const { isConnected, connect } = useWebSocketStore.getState();
    if (!isConnected) {
      connect();
    }
  }, 1000);
}

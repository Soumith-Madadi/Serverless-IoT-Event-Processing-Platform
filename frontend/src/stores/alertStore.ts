import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface AlertRule {
  alertId: string;
  name: string;
  description?: string;
  deviceId?: string;
  conditions: Array<{
    field: string;
    operator: 'gt' | 'gte' | 'lt' | 'lte' | 'eq' | 'neq' | 'contains' | 'not_contains';
    value: string | number | boolean;
  }>;
  severity: 'info' | 'warning' | 'critical';
  enabled: boolean;
  notificationChannels: ('ui' | 'email' | 'webhook')[];
  emailRecipients?: string[];
  webhookUrl?: string;
  cooldownPeriod?: number;
  createdAt: number;
  updatedAt: number;
  userId?: string;
}

export interface AlertInstance {
  alertInstanceId: string;
  alertId: string;
  alertName: string;
  deviceId?: string;
  severity: 'info' | 'warning' | 'critical';
  message: string;
  triggeredAt: number;
  acknowledgedAt?: number;
  acknowledgedBy?: string;
  resolvedAt?: number;
  resolvedBy?: string;
  status: 'active' | 'acknowledged' | 'resolved';
  eventId?: string;
  metadata?: Record<string, any>;
}

interface AlertStore {
  alertRules: AlertRule[];
  activeAlerts: AlertInstance[];
  isLoading: boolean;
  error: string | null;
  fetchAlertRules: () => Promise<void>;
  fetchActiveAlerts: () => Promise<void>;
  createAlertRule: (rule: Partial<AlertRule>) => Promise<void>;
  updateAlertRule: (alertId: string, updates: Partial<AlertRule>) => Promise<void>;
  deleteAlertRule: (alertId: string) => Promise<void>;
  acknowledgeAlert: (alertInstanceId: string) => Promise<void>;
  resolveAlert: (alertInstanceId: string) => Promise<void>;
}

const API_URL = process.env.REACT_APP_API_URL || 'https://ev7csp39fc.execute-api.us-east-1.amazonaws.com/dev';

export const useAlertStore = create<AlertStore>()(
  devtools(
    (set, get) => ({
      alertRules: [],
      activeAlerts: [],
      isLoading: false,
      error: null,

      fetchAlertRules: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/alerts`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch alert rules');
          const data = await response.json();
          set({ alertRules: data.rules || [], isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
        }
      },

      fetchActiveAlerts: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/alerts/active`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to fetch active alerts');
          const data = await response.json();
          set({ activeAlerts: data.alerts || [], isLoading: false });
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
        }
      },

      createAlertRule: async (rule: Partial<AlertRule>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/alerts`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(rule),
          });
          if (!response.ok) throw new Error('Failed to create alert rule');
          const newRule = await response.json();
          set(state => ({
            alertRules: [...state.alertRules, newRule.rule],
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
          throw error;
        }
      },

      updateAlertRule: async (alertId: string, updates: Partial<AlertRule>) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/alerts/${alertId}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
            body: JSON.stringify(updates),
          });
          if (!response.ok) throw new Error('Failed to update alert rule');
          const updated = await response.json();
          set(state => ({
            alertRules: state.alertRules.map(r => r.alertId === alertId ? updated.rule : r),
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
          throw error;
        }
      },

      deleteAlertRule: async (alertId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/alerts/${alertId}`, {
            method: 'DELETE',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to delete alert rule');
          set(state => ({
            alertRules: state.alertRules.filter(r => r.alertId !== alertId),
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
          throw error;
        }
      },

      acknowledgeAlert: async (alertInstanceId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/alerts/${alertInstanceId}/acknowledge`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to acknowledge alert');
          set(state => ({
            activeAlerts: state.activeAlerts.map(a =>
              a.alertInstanceId === alertInstanceId
                ? { ...a, status: 'acknowledged' as const, acknowledgedAt: Date.now() }
                : a
            ),
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
        }
      },

      resolveAlert: async (alertInstanceId: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await fetch(`${API_URL}/alerts/${alertInstanceId}/resolve`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
            },
          });
          if (!response.ok) throw new Error('Failed to resolve alert');
          set(state => ({
            activeAlerts: state.activeAlerts.filter(a => a.alertInstanceId !== alertInstanceId),
            isLoading: false,
          }));
        } catch (error) {
          set({ error: error instanceof Error ? error.message : 'Unknown error', isLoading: false });
        }
      },
    }),
    { name: 'AlertStore' }
  )
);

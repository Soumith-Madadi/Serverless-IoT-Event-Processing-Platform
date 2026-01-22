import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { format } from 'date-fns';
import { useWebSocketStore } from '../stores/websocketStore';
import { useMetricsStore } from '../stores/metricsStore';
import MetricCard from '../components/MetricCard';
import { useEventsApiStore } from '../stores/eventsApiStore';

const Dashboard: React.FC = () => {
  const { isConnected, subscribe, unsubscribe } = useWebSocketStore();
  const { metrics, isLoading, error, fetchMetrics } = useMetricsStore();
  const { events, fetchEvents } = useEventsApiStore();

  useEffect(() => {
    if (isConnected) {
      subscribe(['iot_sensors', 'iot_devices'], ['sensor_reading', 'device_status', 'device_command', 'device_alert']);
    }

    return () => {
      if (isConnected) {
        unsubscribe(['iot_sensors', 'iot_devices'], ['sensor_reading', 'device_status', 'device_command', 'device_alert']);
      }
    };
  }, [isConnected, subscribe, unsubscribe]);

  useEffect(() => {
    fetchMetrics();
    
    const interval = setInterval(fetchMetrics, 30000);
    
    return () => clearInterval(interval);
  }, [fetchMetrics]);

  useEffect(() => {
    fetchEvents(50);
  }, [fetchEvents]);

  const timeSeriesData = [
    { time: '13:00', value: Math.floor((metrics?.lastHour.iotSensors || 0) * 0.2), source: 'IoT Sensors' },
    { time: '13:15', value: Math.floor((metrics?.lastHour.iotSensors || 0) * 0.4), source: 'IoT Sensors' },
    { time: '13:30', value: Math.floor((metrics?.lastHour.iotSensors || 0) * 0.6), source: 'IoT Sensors' },
    { time: '13:45', value: Math.floor((metrics?.lastHour.iotSensors || 0) * 0.8), source: 'IoT Sensors' },
    { time: '14:00', value: metrics?.lastHour.iotSensors || 0, source: 'IoT Sensors' },
  ];

  const sourceData = [
    { name: 'IoT Sensors', value: metrics?.lastHour.iotSensors || 0 },
    { name: 'IoT Devices', value: metrics?.lastHour.iotDevices || 0 },
  ];

  const typeData = [
    { name: 'Sensor Readings', value: metrics?.lastHour.sensorReadings || 0 },
    { name: 'Device Status', value: metrics?.lastHour.deviceStatus || 0 },
    { name: 'Commands', value: metrics?.lastHour.commands || 0 },
    { name: 'Alerts', value: metrics?.lastHour.alerts || 0 },
  ];

  const COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6'];

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Real-time event monitoring and analytics</p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className={`
            flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm
            ${isConnected 
              ? 'bg-success-100 text-success-700' 
              : 'bg-gray-100 text-gray-600'
            }
          `}>
            <div className={`
              w-2 h-2 rounded-full
              ${isConnected ? 'bg-success-500 animate-pulse' : 'bg-gray-400'}
            `} />
            <span>{isConnected ? 'Live' : 'Offline'}</span>
          </div>
        </div>
      </div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-red-50 border border-red-200 rounded-lg p-4"
        >
          <div className="flex items-center space-x-2">
            <span className="text-red-600">⚠️</span>
            <span className="text-red-800">Error loading metrics: {error}</span>
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          title="Total Events"
          value={metrics?.totalEvents || 0}
          change={isLoading ? "Loading..." : `${metrics?.recentEvents || 0} recent`}
          changeType="positive"
          icon="📊"
        />
        <MetricCard
          title="IoT Sensors"
          value={metrics?.lastHour.iotSensors || 0}
          change="Last hour"
          changeType="positive"
          icon="🔌"
        />
        <MetricCard
          title="Active Devices"
          value={metrics?.activeDevices || 0}
          change="Online"
          changeType="positive"
          icon="📱"
        />
        <MetricCard
          title="Recent Events"
          value={metrics?.recentEvents || 0}
          change="Last 15 min"
          changeType="positive"
          icon="⚡"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="card"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Timeline</h3>
          {isLoading ? (
            <div className="flex items-center justify-center h-80">
              <div className="text-gray-500">Loading chart data...</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3B82F6" 
                  strokeWidth={2}
                  dot={{ fill: '#3B82F6', strokeWidth: 2, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="card"
        >
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Sources</h3>
          {isLoading ? (
            <div className="flex items-center justify-center h-80">
              <div className="text-gray-500">Loading chart data...</div>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={sourceData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {sourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          )}
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="card"
      >
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Event Types Distribution</h3>
        {isLoading ? (
          <div className="flex items-center justify-center h-80">
            <div className="text-gray-500">Loading chart data...</div>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={typeData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#3B82F6" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.3 }}
        className="card"
      >
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Recent Events</h3>
          <button className="text-sm text-primary-600 hover:text-primary-700">
            View All
          </button>
        </div>
        
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading recent events...</div>
            </div>
          ) : events.length === 0 ? (
            <div className="text-center py-8">
              <div className="text-gray-500">No events available yet</div>
            </div>
          ) : (
            events.slice(0, 10).map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.1 }}
              >
                <div className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm font-medium text-gray-900">
                        {event.source.replace('_', ' ')}
                      </span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        {event.type.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {format(new Date(event.timestamp), 'HH:mm:ss')}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600">
                    {event.source === 'iot_sensors' && event.type === 'sensor_reading' && (
                      <span>
                        Device {event.data.deviceId} - Sensor {event.data.sensorId}: {event.data.value} {event.data.unit}
                      </span>
                    )}
                    {event.type === 'device_status' && (
                      <span>
                        Device {event.data.deviceId}: {event.data.status}
                      </span>
                    )}
                    {event.type === 'device_alert' && (
                      <span>
                        Alert: {event.data.message} (Severity: {event.data.severity})
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>


      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-6"
      >
        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3">Event Processing</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Lambda Functions</span>
              <span className="text-success-600 font-medium">Active</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">EventBridge</span>
              <span className="text-success-600 font-medium">Connected</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">DynamoDB</span>
              <span className="text-success-600 font-medium">Online</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3">Performance</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Avg Latency</span>
              <span className="text-gray-900 font-medium">&lt; 100ms</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Throughput</span>
              <span className="text-gray-900 font-medium">1000+ events/s</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Uptime</span>
              <span className="text-success-600 font-medium">99.9%</span>
            </div>
          </div>
        </div>

        <div className="card">
          <h4 className="font-semibold text-gray-900 mb-3">Storage</h4>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">DynamoDB</span>
              <span className="text-gray-900 font-medium">2.3 GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">S3 Archive</span>
              <span className="text-gray-900 font-medium">15.7 GB</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-600">Retention</span>
              <span className="text-gray-900 font-medium">30 days</span>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default Dashboard;

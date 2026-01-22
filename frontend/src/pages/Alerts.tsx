import React, { useEffect } from 'react';
import { motion } from 'framer-motion';
import { useAlertStore } from '../stores/alertStore';
import { BellIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/outline';

const Alerts: React.FC = () => {
  const { activeAlerts, alertRules, isLoading, error, fetchActiveAlerts, fetchAlertRules, acknowledgeAlert, resolveAlert } = useAlertStore();

  useEffect(() => {
    fetchActiveAlerts();
    fetchAlertRules();
  }, [fetchActiveAlerts, fetchAlertRules]);

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'warning':
        return <ExclamationTriangleIcon className="w-5 h-5 text-yellow-500" />;
      default:
        return <InformationCircleIcon className="w-5 h-5 text-blue-500" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Alerts</h1>
          <p className="text-gray-600">Monitor and manage device alerts</p>
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
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Alerts</h3>
          {isLoading ? (
            <div className="text-center py-8">
              <div className="text-gray-500">Loading alerts...</div>
            </div>
          ) : activeAlerts.length === 0 ? (
            <div className="text-center py-8">
              <BellIcon className="w-12 h-12 text-gray-300 mx-auto mb-2" />
              <p className="text-gray-500">No active alerts</p>
            </div>
          ) : (
            <div className="space-y-3">
              {activeAlerts.map((alert) => (
                <motion.div
                  key={alert.alertInstanceId}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="border border-gray-200 rounded-lg p-4"
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-start space-x-2">
                      {getSeverityIcon(alert.severity)}
                      <div>
                        <h4 className="font-medium text-gray-900">{alert.alertName}</h4>
                        <p className="text-sm text-gray-600">{alert.message}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      alert.severity === 'critical' ? 'bg-red-100 text-red-800' :
                      alert.severity === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {alert.severity}
                    </span>
                  </div>
                  {alert.deviceId && (
                    <p className="text-xs text-gray-500 mb-2">Device: {alert.deviceId}</p>
                  )}
                  <div className="flex space-x-2 mt-3">
                    {alert.status === 'active' && (
                      <button
                        onClick={() => acknowledgeAlert(alert.alertInstanceId)}
                        className="text-xs btn btn-secondary"
                      >
                        Acknowledge
                      </button>
                    )}
                    <button
                      onClick={() => resolveAlert(alert.alertInstanceId)}
                      className="text-xs btn btn-primary"
                    >
                      Resolve
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <div className="card">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Alert Rules</h3>
          {alertRules.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">No alert rules configured</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alertRules.map((rule) => (
                <div key={rule.alertId} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-medium text-gray-900">{rule.name}</h4>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      rule.enabled ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {rule.enabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </div>
                  {rule.description && (
                    <p className="text-sm text-gray-600 mb-2">{rule.description}</p>
                  )}
                  <div className="text-xs text-gray-500">
                    Severity: {rule.severity} | Channels: {rule.notificationChannels.join(', ')}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;

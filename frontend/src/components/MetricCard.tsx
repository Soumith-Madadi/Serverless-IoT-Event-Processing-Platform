import React from 'react';
import { motion } from 'framer-motion';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: string;
  changeType?: 'positive' | 'negative' | 'neutral';
  icon?: string;
  description?: string;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  description,
}) => {
  const getChangeColor = (type: string) => {
    switch (type) {
      case 'positive':
        return 'text-success-600';
      case 'negative':
        return 'text-danger-600';
      default:
        return 'text-gray-600';
    }
  };

  const getChangeIcon = (type: string) => {
    switch (type) {
      case 'positive':
        return '↗';
      case 'negative':
        return '↘';
      default:
        return '→';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card hover:shadow-md transition-shadow"
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            {icon && <span className="text-xl">{icon}</span>}
            <h3 className="text-sm font-medium text-gray-600">{title}</h3>
          </div>
          
          <div className="flex items-baseline space-x-2">
            <p className="text-2xl font-bold text-gray-900">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </p>
            
            {change && (
              <span className={`text-sm font-medium ${getChangeColor(changeType)}`}>
                {getChangeIcon(changeType)} {change}
              </span>
            )}
          </div>
          
          {description && (
            <p className="text-xs text-gray-500 mt-1">{description}</p>
          )}
        </div>
      </div>
    </motion.div>
  );
};

export default MetricCard;

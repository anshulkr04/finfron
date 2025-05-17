import React from 'react';

type StatusType = 'Positive' | 'Neutral' | 'Negative';

interface StatusIndicatorProps {
  status: StatusType;
  showText?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const StatusIndicator: React.FC<StatusIndicatorProps> = ({
  status,
  showText = false,
  size = 'sm'
}) => {
  const getStatusColor = (status: StatusType) => {
    switch (status) {
      case 'Positive':
        return 'bg-emerald-500';
      case 'Negative':
        return 'bg-rose-500';
      case 'Neutral':
      default:
        return 'bg-amber-400';
    }
  };
  
  const getSizeClass = (size: 'sm' | 'md' | 'lg') => {
    switch (size) {
      case 'lg':
        return 'w-3 h-3';
      case 'md':
        return 'w-2.5 h-2.5';
      case 'sm':
      default:
        return 'w-2 h-2';
    }
  };
  
  return (
    <div className="flex items-center">
      <span className={`inline-block ${getSizeClass(size)} rounded-full ${getStatusColor(status)}`}></span>
      {showText && (
        <span className="text-sm font-medium text-gray-900 ml-2">{status}</span>
      )}
    </div>
  );
};

export default StatusIndicator;
// src/components/common/SocketStatusIndicator.tsx

import React from 'react';
import { useSocket } from '../../context/SocketContext';
import { Wifi, WifiOff, AlertTriangle, Clock } from 'lucide-react';

interface SocketStatusIndicatorProps {
  className?: string;
  showLabel?: boolean;
}

const SocketStatusIndicator: React.FC<SocketStatusIndicatorProps> = ({
  className = '',
  showLabel = true
}) => {
  const socketContext = useSocket();
  
  if (!socketContext) return null;
  
  const { isConnected, connectionStatus } = socketContext;
  
  // Render based on connection status
  let icon;
  let label;
  let colorClass;
  
  switch (connectionStatus) {
    case 'connected':
      icon = <Wifi size={16} />;
      label = 'Live Updates';
      colorClass = 'text-green-500';
      break;
    case 'connecting':
      icon = <Clock size={16} className="pulse-dot" />;
      label = 'Connecting...';
      colorClass = 'text-amber-500';
      break;
    case 'disconnected':
      icon = <WifiOff size={16} />;
      label = 'Disconnected';
      colorClass = 'text-gray-500';
      break;
    case 'error':
      icon = <AlertTriangle size={16} />;
      label = 'Connection Error';
      colorClass = 'text-red-500';
      break;
    default:
      icon = <WifiOff size={16} />;
      label = 'Not Connected';
      colorClass = 'text-gray-500';
  }
  
  return (
    <div className={`flex items-center ${colorClass} ${className}`}>
      <div className="relative">
        {icon}
        <span className={`absolute bottom-0 right-0 w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500 pulse-dot' : 'bg-gray-400'} ring-1 ring-white`}></span>
      </div>
      {showLabel && <span className="ml-2 text-xs font-medium">{label}</span>}
    </div>
  );
};

export default SocketStatusIndicator;
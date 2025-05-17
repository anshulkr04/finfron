// src/components/common/NewAnnouncementIndicator.tsx

import React, { useState, useEffect } from 'react';
import { Bell, ArrowDown } from 'lucide-react';
import { ProcessedAnnouncement } from '../../api';

interface NewAnnouncementIndicatorProps {
  newAnnouncements: ProcessedAnnouncement[];
  onClick: () => void;
  className?: string;
}

const NewAnnouncementIndicator: React.FC<NewAnnouncementIndicatorProps> = ({
  newAnnouncements,
  onClick,
  className = ''
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [count, setCount] = useState(0);
  
  // Update count and visibility when newAnnouncements change
  useEffect(() => {
    const newCount = newAnnouncements.length;
    setCount(newCount);
    
    if (newCount > 0) {
      setIsVisible(true);
    } else {
      // Hide the indicator when there are no new announcements
      setIsVisible(false);
    }
  }, [newAnnouncements]);
  
  // Early return if no new announcements
  if (!isVisible) return null;
  
  return (
    <div 
      className={`fixed bottom-6 right-6 z-50 scale-in-animation ${className}`}
      onClick={onClick}
    >
      <button
        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg flex items-center transition-colors"
        aria-label={`${count} new announcements, click to view`}
      >
        <span className="badge-pulse mr-2 flex items-center justify-center">
          <Bell size={16} />
        </span>
        <span className="font-medium mr-1">{count} new announcement{count !== 1 ? 's' : ''}</span>
        <ArrowDown size={14} />
      </button>
    </div>
  );
};

// Also create a simple inline indicator for use in headers
export const InlineNewAnnouncementIndicator: React.FC<{
  count: number;
  className?: string;
}> = ({ count, className = '' }) => {
  if (count <= 0) return null;
  
  return (
    <div className={`flex items-center text-sm font-medium text-blue-600 ${className}`}>
      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 badge-pulse"></div>
      {count} new update{count !== 1 ? 's' : ''}
    </div>
  );
};

export default NewAnnouncementIndicator;
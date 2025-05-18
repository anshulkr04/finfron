// src/components/announcements/AnnouncementRow.tsx - Updated for better handling of new announcements

import React, { useEffect, useState, useRef } from 'react';
import { Star, StarOff, Bell } from 'lucide-react';
import { ProcessedAnnouncement } from '../../api';
import { extractHeadline } from '../../utils/apiUtils';

interface AnnouncementRowProps {
  announcement: ProcessedAnnouncement;
  isSaved: boolean;
  isViewed: boolean;
  onSave: (id: string) => void;
  onClick: (announcement: ProcessedAnnouncement) => void;
  onCompanyClick: (company: string, e: React.MouseEvent) => void;
  isNew?: boolean;
  onMarkAsRead?: (id: string) => void;
}

const AnnouncementRow: React.FC<AnnouncementRowProps> = ({
  announcement,
  isSaved,
  isViewed,
  onSave,
  onClick,
  onCompanyClick,
  isNew = false,
  onMarkAsRead
}) => {
  // State to manage animation and highlighting
  const [isHighlighted, setIsHighlighted] = useState(isNew);
  const [isPulsing, setIsPulsing] = useState(isNew);
  const [isAnimating, setIsAnimating] = useState(isNew);
  const rowRef = useRef<HTMLDivElement>(null);
  const transitionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Add animation and highlighting for new announcements
  useEffect(() => {
  if (isNew) {
    // Set highlight and animation
    setIsHighlighted(true);
    setIsAnimating(true);
    setIsPulsing(true);
    
    // Only stop the pulse animation after 5 seconds, not the highlight
    const animationTimer = setTimeout(() => {
      setIsAnimating(false);
      setIsPulsing(false);
    }, 5000);
    
    // No timer to clear the highlight - it stays until clicked
    
    return () => {
      clearTimeout(animationTimer);
    };
  }
}, [isNew]);
  
  // When the isNew prop changes from false to true (e.g., for a new update)
  // useEffect(() => {
  //   if (isNew) {
  //     setIsHighlighted(true);
  //     setIsAnimating(true);
  //     setIsPulsing(true);
      
  //     // Try to scroll into view when new arrives
  //     if (rowRef.current) {
  //       setTimeout(() => {
  //         rowRef.current?.scrollIntoView({ 
  //           behavior: 'smooth', 
  //           block: 'center'
  //         });
  //       }, 100);
  //     }
  //   }
  // }, [isNew]);

  const handleRowClick = () => {
    // Mark as read when clicked
    if (onMarkAsRead && isNew) {
      onMarkAsRead(announcement.id);
    }
    
    // Call the original click handler
    onClick(announcement);
    
    // Clear highlight state when clicked
    setIsHighlighted(false);
    setIsPulsing(false);
    setIsAnimating(false);
  };

  // Company display values
  const companyDisplayName = announcement.company || "Unknown Company";
  const companyDisplaySymbol = announcement.ticker || "";

  // Get display values
  const categoryToDisplay = announcement.category || 'Other';
  const headlineToDisplay = extractHeadline(announcement.summary);

  // Use the displayDate if available
  const dateToDisplay = announcement.displayDate || announcement.date;

  // Custom CSS for animation
  const animationClass = isAnimating ? 'animate-pulse-slow' : '';
  const highlightClass = isHighlighted ? 'bg-blue-50' : '';
  const viewedClass = isViewed && !isHighlighted ? 'text-gray-600' : 'text-gray-800';
  const pulsingClass = isPulsing ? 'badge-pulse' : '';

  return (
    <div
      ref={rowRef}
      className={`grid grid-cols-12 px-6 py-4 hover:bg-gray-50/80 cursor-pointer transition-all duration-200 items-center ${viewedClass} ${highlightClass} ${animationClass} announcement-row-transition`}
      onClick={handleRowClick}
      data-announcement-id={announcement.id}
      data-is-new={isNew ? 'true' : 'false'}
    >
      {/* Indicator dot for unread or new announcements */}
      {(!isViewed || isHighlighted) && (
        <div className={`absolute left-1 w-1 h-1 rounded-full ${isHighlighted ? 'bg-blue-500' : 'bg-green-500'} ${pulsingClass}`}></div>
      )}

      {/* Company information */}
      <div className="col-span-3 pr-4">
        <div
          className={`font-medium company-name truncate inline-block relative group ${isHighlighted ? 'text-blue-700' : ''}`}
          onClick={(e) => onCompanyClick(companyDisplayName, e)}
        >
          {companyDisplayName}
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-black/80 transition-all duration-300 ease-in-out group-hover:w-full opacity-80"></span>
        </div>
        <div className="text-xs text-gray-500 mt-1 truncate flex items-center">
          {companyDisplaySymbol}
          {isHighlighted && (
            <span className="ml-2 text-xs font-medium text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded-full flex items-center">
              <Bell size={10} className="mr-1" />
              NEW
            </span>
          )}
        </div>
      </div>

      {/* Category */}
      <div className="col-span-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          isViewed && !isHighlighted ? 'bg-gray-100/80 text-gray-600' : 'bg-gray-100 text-gray-800 shadow-sm'
        } ${isHighlighted ? 'bg-blue-100 text-blue-800' : ''} border border-gray-100/60`}>
          {categoryToDisplay}
        </span>
      </div>

      {/* Summary */}
      <div className="col-span-5 text-sm pr-4">
        <div className={`summary-text line-clamp-2 leading-relaxed overflow-hidden ${
          isViewed && !isHighlighted ? 'text-gray-500' : 'text-gray-700'
        } ${isHighlighted ? 'font-medium' : ''}`}>
          {headlineToDisplay}
        </div>
      </div>

      {/* Sentiment indicator */}
      <div className="col-span-1 flex justify-center items-center">
        <span className={`inline-flex w-2.5 h-2.5 rounded-full ${
          announcement.sentiment === 'Positive' ? 'bg-emerald-500' :
          announcement.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-amber-400'
        } ${isViewed && !isHighlighted ? 'opacity-60' : 'shadow-sm'}`}></span>
      </div>

      {/* Save button */}
      <div className="col-span-1 flex items-center justify-end">
        <div className="text-xs text-gray-400 mr-3">{dateToDisplay}</div>
        <button
          className="text-gray-400 hover:text-gray-900 p-1.5 rounded-full hover:bg-gray-100/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onSave(announcement.id);
          }}
          aria-label={isSaved ? "Remove from saved" : "Save announcement"}
        >
          {isSaved ?
            <Star size={16} className="fill-current text-black" /> :
            <StarOff size={16} />}
        </button>
      </div>
    </div>
  );
};

// Add the CSS for the animation
// This would go in your global CSS or in a style tag
const AnimationStyles = () => (
  <style jsx global>{`
    @keyframes pulse-slow {
      0%, 100% {
        background-color: rgba(239, 246, 255, 0.6);
      }
      50% {
        background-color: rgba(219, 234, 254, 1);
      }
    }
    
    .animate-pulse-slow {
      animation: pulse-slow 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
    }
    
    /* Badge pulse animation */
    @keyframes badge-pulse {
      0%, 100% {
        opacity: 1;
        transform: scale(1);
      }
      50% {
        opacity: 0.6;
        transform: scale(1.2);
      }
    }
    
    .badge-pulse {
      animation: badge-pulse 1.5s infinite ease-in-out;
    }
    
    /* Transition for non-animating elements */
    .bg-blue-50 {
      transition: background-color 0.5s ease-in-out;
    }
    
    /* New announcement indicator flash */
    @keyframes flash {
      0% {
        background-color: rgba(219, 234, 254, 0.9);
      }
      100% {
        background-color: transparent;
      }
    }
    
    .flash-animation {
      animation: flash 1.5s ease-out;
    }
    
    /* Smooth transition for all row changes */
    .announcement-row-transition {
      transition: background-color 0.5s ease-out, color 0.3s ease-out, transform 0.3s ease-out;
    }
    
    /* Special animation for newly arrived announcements */
    .announcement-row-new-arrival {
      animation: slideDown 0.5s ease-out forwards;
    }
    
    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
  `}</style>
);

// Export both component and styles
export { AnimationStyles };
export default AnnouncementRow;
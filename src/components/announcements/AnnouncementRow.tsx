import React, { useEffect, useContext } from 'react';
import { Star, StarOff } from 'lucide-react';
import { ProcessedAnnouncement } from '../../api';
import { extractHeadline } from '../../utils/apiUtils';
import { SocketContext } from '../../context/SocketContext'; // We'll create this context

interface AnnouncementRowProps {
  announcement: ProcessedAnnouncement;
  isSaved: boolean;
  isViewed: boolean;
  onSave: (id: string) => void;
  onClick: (announcement: ProcessedAnnouncement) => void;
  onCompanyClick: (company: string, e: React.MouseEvent) => void;
  isNew?: boolean; // Flag to indicate if this is a new announcement from socket
}

const AnnouncementRow: React.FC<AnnouncementRowProps> = ({
  announcement,
  isSaved,
  isViewed,
  onSave,
  onClick,
  onCompanyClick,
  isNew = false
}) => {
  // Get socket connection from context
  const socketConnection = useContext(SocketContext);
  
  // Subscribe to company-specific updates when component mounts
  useEffect(() => {
    // Only subscribe if we have a valid ticker or ISIN
    if (announcement.ticker) {
      socketConnection?.joinRoom(announcement.ticker);
    }
    
    if (announcement.isin) {
      socketConnection?.joinRoom(announcement.isin);
    }
    
    // Cleanup on unmount
    return () => {
      if (announcement.ticker) {
        socketConnection?.leaveRoom(announcement.ticker);
      }
      
      if (announcement.isin) {
        socketConnection?.leaveRoom(announcement.isin);
      }
    };
  }, [announcement.ticker, announcement.isin, socketConnection]);

  // No longer need state variables or useEffect for company lookups
  // Just use the company name and ticker directly from the announcement
  const companyDisplayName = announcement.company || "Unknown Company";
  const companyDisplaySymbol = announcement.ticker || "";

  const categoryToDisplay = announcement.category || 'Other';
  const headlineToDisplay = extractHeadline(announcement.summary);

  return (
    <div
      className={`grid grid-cols-12 px-6 py-4 hover:bg-gray-50/80 cursor-pointer transition-all duration-200 items-center ${
        isViewed
          ? 'announcement-row-viewed text-gray-600'
          : 'announcement-row-unread text-gray-800'
      } ${isNew ? 'animate-pulse-slow bg-blue-50' : ''}`}
      onClick={() => onClick(announcement)}
    >
      {(!isViewed || isNew) && (
        <div className={`unread-badge ${isNew ? 'bg-blue-500' : ''}`}>
          {isNew ? 'LIVE' : 'NEW'}
        </div>
      )}

      <div className="col-span-3 pr-4">
        <div
          className={`font-medium company-name truncate inline-block relative group`}
          onClick={(e) => onCompanyClick(companyDisplayName, e)}
        >
          {companyDisplayName}
          <span className="absolute bottom-0 left-0 w-0 h-0.5 bg-black/80 transition-all duration-300 ease-in-out group-hover:w-full opacity-80"></span>
        </div>
        <div className="text-xs text-gray-500 mt-1 truncate">{companyDisplaySymbol}</div>
      </div>

      <div className="col-span-2">
        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
          isViewed && !isNew ? 'bg-gray-100/80 text-gray-600' : 'bg-gray-100 text-gray-800 shadow-sm'
        } ${isNew ? 'bg-blue-100 text-blue-800' : ''} border border-gray-100/60`}>
          {categoryToDisplay}
        </span>
      </div>

      <div className="col-span-5 text-sm pr-4">
        <div className={`summary-text line-clamp-2 leading-relaxed overflow-hidden ${
          isViewed && !isNew ? 'text-gray-500' : 'text-gray-700'
        }`}>
          {headlineToDisplay}
        </div>
      </div>

      <div className="col-span-1 flex justify-center items-center">
        <span className={`inline-flex w-2.5 h-2.5 rounded-full ${
          announcement.sentiment === 'Positive' ? 'bg-emerald-500' :
          announcement.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-amber-400'
        } ${isViewed && !isNew ? 'opacity-60' : 'shadow-sm'}`}></span>
      </div>

      <div className="col-span-1 flex items-center justify-end">
        <button
          className="text-gray-400 hover:text-gray-900 p-1.5 rounded-full hover:bg-gray-100/80 transition-colors"
          onClick={(e) => {
            e.stopPropagation();
            onSave(announcement.id);
          }}
        >
          {isSaved ?
            <Star size={16} className="fill-current text-black" /> :
            <StarOff size={16} />}
        </button>
      </div>
    </div>
  );
};

export default AnnouncementRow;
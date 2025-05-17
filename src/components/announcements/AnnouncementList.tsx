import React, { useRef, useEffect, useState } from 'react';
import { ProcessedAnnouncement } from '../../api';
import AnnouncementRow from './AnnouncementRow';
import Pagination from '../common/Pagination';

interface AnnouncementListProps {
  announcements: ProcessedAnnouncement[];
  savedFilings: string[];
  showSavedOnly: boolean;
  isLoading: boolean;
  error: string | null;
  onSaveToggle: (id: string) => void;
  onAnnouncementClick: (announcement: ProcessedAnnouncement) => void;
  onCompanyClick: (company: string, e: React.MouseEvent) => void;
  onClearFilters: () => void;
}

const ITEMS_PER_PAGE = 15; // Number of announcements per page

const AnnouncementList: React.FC<AnnouncementListProps> = ({
  announcements,
  savedFilings,
  showSavedOnly,
  isLoading,
  error,
  onSaveToggle,
  onAnnouncementClick,
  onCompanyClick,
  onClearFilters
}) => {
  const tableHeaderRef = useRef<HTMLDivElement>(null);
  const tableContentRef = useRef<HTMLDivElement>(null);
  const [viewedAnnouncements, setViewedAnnouncements] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Load viewed announcements from localStorage on mount
  useEffect(() => {
    const viewed = localStorage.getItem('viewedAnnouncements');
    if (viewed) {
      try {
        setViewedAnnouncements(JSON.parse(viewed));
      } catch (e) {
        console.error('Error loading viewed announcements:', e);
      }
    }
  }, []);

  // Reset to page 1 when announcements change
  useEffect(() => {
    setCurrentPage(1);
  }, [announcements, showSavedOnly]);

  // Calculate pagination values
  const displayedAnnouncements = showSavedOnly 
    ? announcements.filter(item => savedFilings.includes(item.id))
    : announcements;
    
  const totalItems = displayedAnnouncements.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  
  // Get current page items
  const getCurrentPageItems = () => {
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayedAnnouncements.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the list
    if (tableContentRef.current) {
      tableContentRef.current.scrollTop = 0;
    }
  };

  // Handle announcement click - mark it as viewed
  const handleAnnouncementClick = (announcement: ProcessedAnnouncement) => {
    if (!viewedAnnouncements.includes(announcement.id)) {
      const updatedViewed = [...viewedAnnouncements, announcement.id];
      setViewedAnnouncements(updatedViewed);
      localStorage.setItem('viewedAnnouncements', JSON.stringify(updatedViewed));
    }
    onAnnouncementClick(announcement);
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
      </div>
    );
  }
  
  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-red-500">{error}</div>
      </div>
    );
  }
  
  if (displayedAnnouncements.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64">
        <div className="text-gray-500 mb-4">
          {showSavedOnly 
            ? "You don't have any saved filings yet" 
            : "No announcements match your filters"}
        </div>
        {!showSavedOnly && (
          <button 
            className="px-4 py-2 text-sm font-medium text-black bg-gray-100 rounded-lg hover:bg-gray-200"
            onClick={onClearFilters}
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }
  
  const currentPageItems = getCurrentPageItems();
  
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 w-full max-w-full">
      {/* Table Header - Apple-inspired style */}
      <div 
        ref={tableHeaderRef} 
        className="bg-white rounded-t-2xl z-10"
        style={{ position: 'sticky', top: '0' }}
      >
        <div className="grid grid-cols-12 px-6 py-4 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase bg-gray-50 rounded-t-2xl">
          <div className="col-span-3 flex items-center">
            <span>Company</span>
            <button 
              className="ml-2 p-1 rounded-full hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 focus:outline-none transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                // This should show the filter modal - calling the parent component's method
                if (typeof window !== 'undefined') {
                  // Dispatch a custom event to open the filter modal
                  const event = new CustomEvent('openFilterModal');
                  window.dispatchEvent(event);
                }
              }}
              title="Filter Companies"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
              </svg>
            </button>
          </div>
          <div className="col-span-2">Category</div>
          <div className="col-span-5 pr-4">Summary</div>
          <div className="col-span-1 text-center">Status</div>
          <div className="col-span-1 text-right">Save</div>
        </div>
      </div>
      
      {/* Scrollable Content - Apple-inspired styling */}
      <div className="divide-y divide-gray-100/80" ref={tableContentRef}>
        {currentPageItems.map((announcement) => (
          <AnnouncementRow 
            key={announcement.id} 
            announcement={announcement}
            isSaved={savedFilings.includes(announcement.id)}
            isViewed={viewedAnnouncements.includes(announcement.id)}
            onSave={onSaveToggle}
            onClick={handleAnnouncementClick}
            onCompanyClick={onCompanyClick}
          />
        ))}
      </div>
      
      {/* Pagination controls */}
      {totalPages > 1 && (
        <div className="border-t border-gray-100">
          <Pagination 
            currentPage={currentPage}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        </div>
      )}
    </div>
  );
};

export default AnnouncementList;
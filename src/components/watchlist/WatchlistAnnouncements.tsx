import React, { useState, useEffect } from 'react';
import { fetchAnnouncements, ProcessedAnnouncement, Company } from '../../api';
import AnnouncementList from '../announcements/AnnouncementList';
import DetailPanel from '../announcements/DetailPanel';
import { useWatchlist } from '../../context/WatchlistContext';

interface WatchlistAnnouncementsProps {
  watchlistId: string;
  onViewAnnouncements: (company: Company) => void;
}

const WatchlistAnnouncements: React.FC<WatchlistAnnouncementsProps> = ({ 
  watchlistId,
  onViewAnnouncements
}) => {
  const [announcements, setAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ProcessedAnnouncement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedFilings, setSavedFilings] = useState<string[]>([]);
  const [showSavedFilings, setShowSavedFilings] = useState(false);
  
  const { getWatchlistById } = useWatchlist();
  
  // Load saved filings from localStorage
  useEffect(() => {
    const savedItems = localStorage.getItem('savedFilings');
    if (savedItems) {
      setSavedFilings(JSON.parse(savedItems));
    }
  }, []);
  
  // Update localStorage when savedFilings changes
  useEffect(() => {
    localStorage.setItem('savedFilings', JSON.stringify(savedFilings));
  }, [savedFilings]);
  
  // Get current watchlist
  const watchlist = getWatchlistById(watchlistId);
  
  // Fetch all announcements and filter for watchlist companies/categories
  useEffect(() => {
    const loadAnnouncements = async () => {
      if (!watchlist) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        // Use a much larger date range (1 year) for all watchlist types
        const endDate = new Date().toISOString().split('T')[0];
        
        // Use 1 year for all watchlists
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        const startDate = oneYearAgo.toISOString().split('T')[0];
        
        console.log(`Fetching announcements from ${startDate} to ${endDate}`);
        const data = await fetchAnnouncements(startDate, endDate);
        setAnnouncements(data);
        
        // Filter announcements based on watchlist type
        if (watchlist.categories && watchlist.categories.length > 0) {
          // Category-based filtering
          console.log(`Filtering by ${watchlist.categories.length} categories`);
          const categoryFiltered = data.filter(announcement => 
            watchlist.categories?.includes(announcement.category)
          );
          setFilteredAnnouncements(categoryFiltered);
          console.log(`Found ${categoryFiltered.length} announcements matching categories`);
        } 
        
        if (watchlist.companies && watchlist.companies.length > 0) {
          // Company-based filtering
          console.log(`Filtering by ${watchlist.companies.length} companies`);
          const companyFiltered = data.filter(announcement => 
            watchlist.companies.some(company => 
              company.symbol === announcement.ticker || company.name === announcement.company
            )
          );
          
          // If we have both categories and companies, merge the results
          if (watchlist.categories && watchlist.categories.length > 0) {
            const categoryFiltered = filteredAnnouncements;
            // Combine unique announcements from both filters
            const combinedAnnouncements = [...categoryFiltered];
            
            // Add company announcements that aren't already included
            companyFiltered.forEach(announcement => {
              if (!combinedAnnouncements.some(a => a.id === announcement.id)) {
                combinedAnnouncements.push(announcement);
              }
            });
            
            setFilteredAnnouncements(combinedAnnouncements);
            console.log(`Combined total: ${combinedAnnouncements.length} announcements`);
          } else {
            setFilteredAnnouncements(companyFiltered);
            console.log(`Found ${companyFiltered.length} announcements matching companies`);
          }
        } else if (!watchlist.categories || watchlist.categories.length === 0) {
          // If no companies and no categories
          setFilteredAnnouncements([]);
        }
      } catch (err) {
        console.error('Error fetching announcements:', err);
        setError('Failed to load announcements. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAnnouncements();
  }, [watchlist, watchlistId]);
  
  // Toggle saved filing function
  const toggleSavedFiling = (id: string) => {
    setSavedFilings(prevSavedFilings => {
      if (prevSavedFilings.includes(id)) {
        return prevSavedFilings.filter(filingId => filingId !== id);
      } else {
        return [...prevSavedFilings, id];
      }
    });
  };
  
  // Handle company click - fixed type error by converting string to Company
  const handleCompanyClick = (companyName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Find matching company in watchlist
    const watchlistCompany = watchlist?.companies.find(c => c.name === companyName || c.symbol === companyName);
    if (watchlistCompany) {
      onViewAnnouncements(watchlistCompany);
    } else {
      // If company not found in watchlist, create a dummy Company object
      const dummyCompany: Company = {
        id: companyName,
        name: companyName,
        symbol: companyName,
        isin: '',
        industry: ''
      };
      onViewAnnouncements(dummyCompany);
    }
  };
  
  // Handle announcement click
  const handleAnnouncementClick = (announcement: ProcessedAnnouncement) => {
    setSelectedDetail(announcement);
  };
  
  // Calculate announcement stats
  const stats = {
    total: filteredAnnouncements.length,
    positive: filteredAnnouncements.filter(a => a.sentiment === 'Positive').length,
    negative: filteredAnnouncements.filter(a => a.sentiment === 'Negative').length,
    neutral: filteredAnnouncements.filter(a => a.sentiment === 'Neutral').length,
  };
  
  return (
    <div className="mt-6">
      <div className="mb-6">
        <h3 className="text-lg font-medium text-gray-900 mb-2">Recent Announcements</h3>
        <div className="text-sm text-gray-600">
          {stats.total > 0 ? (
            <div className="flex items-center space-x-4">
              <span>Found {stats.total} announcement{stats.total !== 1 ? 's' : ''} for your watchlist</span>
              <div className="flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5"></span>
                <span>{stats.positive} positive</span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-amber-400 mr-1.5"></span>
                <span>{stats.neutral} neutral</span>
              </div>
              <div className="flex items-center">
                <span className="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1.5"></span>
                <span>{stats.negative} negative</span>
              </div>
            </div>
          ) : !isLoading && (
            <span>No recent announcements found for your watchlist</span>
          )}
        </div>
      </div>
      
      {/* FIX: Add max-height and overflow-y-auto to container div */}
      <div className="max-h-[calc(100vh-250px)] overflow-y-auto">
        <AnnouncementList
          announcements={filteredAnnouncements}
          savedFilings={savedFilings}
          showSavedOnly={showSavedFilings}
          isLoading={isLoading}
          error={error}
          onSaveToggle={toggleSavedFiling}
          onAnnouncementClick={handleAnnouncementClick}
          onCompanyClick={handleCompanyClick}
          onClearFilters={() => {}}
        />
      </div>
      
      {/* Detail Panel */}
      {selectedDetail && (
        <>
          <div 
            className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20"
            onClick={() => setSelectedDetail(null)}
          ></div>
          <DetailPanel 
            announcement={selectedDetail}
            isSaved={savedFilings.includes(selectedDetail.id)}
            onClose={() => setSelectedDetail(null)}
            onSave={toggleSavedFiling}
            onViewAllAnnouncements={(company) => {
              // Create a dummy Company object from company string
              const dummyCompany: Company = {
                id: typeof company === 'string' ? company : company.id || '',
                name: typeof company === 'string' ? company : company.name || '',
                symbol: typeof company === 'string' ? company : company.symbol || '',
                isin: '',
                industry: ''
              };
              onViewAnnouncements(dummyCompany);
            }}
          />
        </>
      )}
    </div>
  );
};

export default WatchlistAnnouncements;
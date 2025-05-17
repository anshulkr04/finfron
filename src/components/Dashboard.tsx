import React, { useState, useEffect, useRef } from 'react';
import { Search, Calendar as CalendarIcon, Filter as FilterIcon } from 'lucide-react';
import { fetchAnnouncements, ProcessedAnnouncement, Company, searchCompanies } from '../api';
import MainLayout from './layout/MainLayout';
import MetricsPanel from './common/MetricsPanel';
import DetailPanel from './announcements/DetailPanel';
import FilterModal from './common/FilterModal';
import Pagination from './common/Pagination';
import { useFilters } from '../context/FilterContext';
import { Star, StarOff } from 'lucide-react';
import { extractHeadline } from '../utils/apiUtils';
import AnnouncementRow from './announcements/AnnouncementRow';

// Define an interface for the API search results
interface CompanySearchResult {
  ISIN: string;
  NewName?: string;
  OldName?: string;
  NewNSEcode?: string;
  OldNSEcode?: string;
  industry?: string;
}

interface DashboardProps {
  onNavigate: (page: 'home' | 'watchlist' | 'company') => void;
  onCompanySelect: (company: Company) => void;
}

const ITEMS_PER_PAGE = 15; // Number of announcements per page

const Dashboard: React.FC<DashboardProps> = ({ onNavigate, onCompanySelect }) => {
  // State management
  const [announcements, setAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const [filteredAnnouncements, setFilteredAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [savedFilings, setSavedFilings] = useState<string[]>([]);
  const [showSavedFilings, setShowSavedFilings] = useState(false);
  const [selectedDetail, setSelectedDetail] = useState<ProcessedAnnouncement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [viewedAnnouncements, setViewedAnnouncements] = useState<string[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'company' | 'category'>('all');
  
  // Search-specific state
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  
  const { 
    filters, 
    setSearchTerm, 
    setDateRange,
    setSelectedCompany,
    setSelectedCategories,
    setSelectedSentiments,
    setSelectedIndustries
  } = useFilters();
  
  // Fetch data from API with improved date handling
  useEffect(() => {
    const loadAnnouncements = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        // Check if dates are valid before fetching
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        const startDate = dateRegex.test(filters.dateRange.start) ? filters.dateRange.start : '';
        const endDate = dateRegex.test(filters.dateRange.end) ? filters.dateRange.end : '';
        
        console.log(`Fetching announcements with date range: ${startDate} to ${endDate}`);
        
        const industry = filters.selectedIndustries.length === 1 ? filters.selectedIndustries[0] : '';
        const data = await fetchAnnouncements(startDate, endDate, industry);
        
        console.log(`Received ${data.length} announcements from API`);
        
        setAnnouncements(data);
        setFilteredAnnouncements(data);
        // Reset to first page when data changes
        setCurrentPage(1);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load announcements. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAnnouncements();
  }, [filters.dateRange, filters.selectedIndustries]);
  
  // Real-time company search with API integration
  useEffect(() => {
    if (filters.searchTerm.length < 2) {
      setSearchResults([]);
      return;
    }
    
    const searchTimer = setTimeout(async () => {
      setIsSearchLoading(true);
      try {
        const results = await searchCompanies(filters.searchTerm, 10);
        setSearchResults(results);
        if (results.length > 0) {
          setShowSearchResults(true);
        }
      } catch (error) {
        console.error('Error searching companies:', error);
      } finally {
        setIsSearchLoading(false);
      }
    }, 300); // 300ms debounce
    
    return () => clearTimeout(searchTimer);
  }, [filters.searchTerm]);
  
  // Handle click outside to close search results
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchResults(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Apply additional filters
  useEffect(() => {
    let result = [...announcements];
    
    // Company filter
    if (filters.selectedCompany) {
      result = result.filter(item => item.company === filters.selectedCompany);
    }
    
    // Search term filter - now including ISIN
    if (filters.searchTerm) {
      result = result.filter(item => 
        item.company.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.summary.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        item.ticker.toLowerCase().includes(filters.searchTerm.toLowerCase()) ||
        // Add ISIN to the search
        (item.isin && item.isin.toLowerCase().includes(filters.searchTerm.toLowerCase()))
      );
    }
    
    if (filters.selectedCategories.length > 0) {
      result = result.filter(item => filters.selectedCategories.includes(item.category));
    }
    
    if (filters.selectedSentiments.length > 0) {
      result = result.filter(item => filters.selectedSentiments.includes(item.sentiment));
    }
    
    setFilteredAnnouncements(result);
    // Reset to first page when filters change
    setCurrentPage(1);
  }, [
    announcements, 
    filters.searchTerm, 
    filters.selectedCategories, 
    filters.selectedSentiments, 
    filters.selectedCompany
  ]);
  
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
  
  // Save filings to localStorage
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
  
  // Handle search result selection
  const handleSearchSelect = (companyData: CompanySearchResult) => {
    // Create a Company object from the API response
    const company: Company = {
      id: companyData.ISIN || `company-${Date.now()}`,
      name: companyData.NewName || companyData.OldName || '',
      symbol: companyData.NewNSEcode || companyData.OldNSEcode || '',
      isin: companyData.ISIN || '',
      industry: companyData.industry || ''
    };
    
    setShowSearchResults(false);
    onCompanySelect(company);
  };
  
  // Calculate pagination values
  const totalItems = showSavedFilings 
    ? filteredAnnouncements.filter(item => savedFilings.includes(item.id)).length
    : filteredAnnouncements.length;
    
  const totalPages = Math.max(1, Math.ceil(totalItems / ITEMS_PER_PAGE));
  
  // Get current page items
  const getCurrentPageItems = () => {
    const displayedAnnouncements = showSavedFilings 
      ? filteredAnnouncements.filter(item => savedFilings.includes(item.id))
      : filteredAnnouncements;
      
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    return displayedAnnouncements.slice(startIndex, startIndex + ITEMS_PER_PAGE);
  };
  
  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    // Scroll to top of the list
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  
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
  
  // Improved date change handler with validation
  const handleDateChange = (type: 'start' | 'end', value: string) => {
    // Log the date input for debugging
    console.log(`Date input (${type}):`, value);
    
    // Validate that the input is a proper date in YYYY-MM-DD format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    
    if (!dateRegex.test(value) && value !== '') {
      console.warn(`Invalid date format for ${type}: ${value}`);
      return; // Don't update if format is invalid but not empty
    }
    
    // Set the date range in the filters
    setDateRange(
      type === 'start' ? value : filters.dateRange.start,
      type === 'end' ? value : filters.dateRange.end
    );
    
    // Log the updated date range for debugging
    console.log("Updated date range:", {
      start: type === 'start' ? value : filters.dateRange.start,
      end: type === 'end' ? value : filters.dateRange.end
    });
  };
  
  const resetFilters = () => {
    setShowSavedFilings(false);
    setSelectedDetail(null);
    setSearchTerm('');
    setSelectedCategories([]);
    setSelectedSentiments([]);
    setSelectedIndustries([]);
    setSelectedCompany(null);
  };
  
  // Handle announcement click - mark it as viewed
  const handleAnnouncementClick = (announcement: ProcessedAnnouncement) => {
    if (!viewedAnnouncements.includes(announcement.id)) {
      const updatedViewed = [...viewedAnnouncements, announcement.id];
      setViewedAnnouncements(updatedViewed);
      localStorage.setItem('viewedAnnouncements', JSON.stringify(updatedViewed));
    }
    setSelectedDetail(announcement);
  };
  
  // Handle company name click to navigate to company page
  const handleCompanyClick = (company: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering the row click event
    
    // Find a matching announcement to get company details
    const companyAnnouncement = announcements.find(a => a.company === company);
    if (companyAnnouncement) {
      const companyObj: Company = {
        id: companyAnnouncement.companyId,
        name: company,
        symbol: companyAnnouncement.ticker,
        industry: companyAnnouncement.industry,
        isin: companyAnnouncement.isin || '' // Make sure to include ISIN
      };
      onCompanySelect(companyObj);
    }
  };
  
  // Open filter modal with specified type
  const openFilterModal = (type: 'all' | 'company' | 'category') => {
    setFilterType(type);
    setShowFilterModal(true);
  };

  // Listen for custom event to open filter modal
  useEffect(() => {
    const handleOpenFilterModal = () => {
      setShowFilterModal(true);
    };

    window.addEventListener('openFilterModal', handleOpenFilterModal);
    
    return () => {
      window.removeEventListener('openFilterModal', handleOpenFilterModal);
    };
  }, []);
  
  // Display current page announcements
  const displayedAnnouncements = getCurrentPageItems();
  
  // Custom header content with date pickers
  const headerContent = (
    <div className="flex items-center space-x-2">
      {/* Enhanced Search with dropdown */}
      <div className="relative w-72" ref={searchRef}>
        <div className="flex items-center">
          <Search className="text-gray-400 absolute ml-3" size={16} />
          <input
            type="text"
            placeholder="Search by name, ticker, or ISIN..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-300 transition-all"
            value={filters.searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (filters.searchTerm.length >= 2 && searchResults.length > 0) {
                setShowSearchResults(true);
              }
            }}
          />
          {isSearchLoading && (
            <div className="absolute right-3 top-2.5">
              <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-gray-900"></div>
            </div>
          )}
        </div>
        
        {/* Search Results Dropdown - Updated to show ISIN */}
        {showSearchResults && searchResults.length > 0 && (
          <div className="absolute z-40 mt-2 w-full bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <ul className="max-h-80 overflow-y-auto divide-y divide-gray-100">
              {searchResults.map((company, index) => (
                <li 
                  key={company.ISIN || `result-${index}`} 
                  className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSearchSelect(company)}
                >
                  <div className="font-medium text-gray-900">{company.NewName || company.OldName}</div>
                  <div className="flex flex-wrap items-center mt-1 gap-2">
                    {(company.NewNSEcode || company.OldNSEcode) && (
                      <span className="text-xs font-semibold bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md">
                        {company.NewNSEcode || company.OldNSEcode}
                      </span>
                    )}
                    {company.ISIN && (
                      <span className="text-xs font-semibold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md">
                        ISIN: {company.ISIN}
                      </span>
                    )}
                    {company.industry && (
                      <span className="text-xs text-gray-500">
                        {company.industry}
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      
      <div className="flex items-center space-x-2">
        {/* Updated date inputs with validation attributes */}
        <input
          type="date"
          value={filters.dateRange.start}
          min="2010-01-01"
          max={filters.dateRange.end || new Date().toISOString().split('T')[0]}
          onChange={(e) => handleDateChange('start', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
        <span className="text-gray-500">-</span>
        <input
          type="date"
          value={filters.dateRange.end}
          min={filters.dateRange.start || "2010-01-01"}
          max={new Date().toISOString().split('T')[0]}
          onChange={(e) => handleDateChange('end', e.target.value)}
          className="px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-700 focus:outline-none focus:ring-1 focus:ring-gray-300"
        />
      </div>
    </div>
  );
  
  return (
    <MainLayout 
      activePage="home"
      selectedCompany={filters.selectedCompany}
      setSelectedCompany={setSelectedCompany}
      headerRight={headerContent}
      onNavigate={onNavigate}
    >
      {/* Main content container with scrolling */}
      <div className="flex flex-col h-full overflow-auto">
        {/* Dashboard header - will scroll away */}
        <div className="py-4 px-6 bg-white border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-xl font-semibold text-gray-900">Announcements Dashboard</h1>
            <div className="ml-3 flex items-center">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div>
              <span className="text-xs font-medium text-gray-700">AI-Powered</span>
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="mr-6 text-sm font-medium">
              Filtered Announcements: {filteredAnnouncements.length}
            </div>
            <div className="flex items-center text-sm font-medium text-gray-700">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              Updates every 15 minutes
            </div>
          </div>
        </div>
        
        {/* Metrics section - will scroll away */}
        <div className="bg-white border-b border-gray-100">
          <MetricsPanel announcements={filteredAnnouncements} />
        </div>
        
        {/* Company filter bar (optional) - will scroll away */}
        {filters.selectedCompany && (
          <div className="bg-white px-6 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm text-gray-500">Filtering by company:</span>
              <span className="ml-2 text-sm font-medium text-black bg-gray-100 px-3 py-1 rounded-lg flex items-center">
                {filters.selectedCompany}
                <button 
                  onClick={() => setSelectedCompany(null)}
                  className="ml-2 text-gray-400 hover:text-gray-700 focus:outline-none"
                >
                  <span className="sr-only">Remove</span>
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </span>
            </div>
            <button 
              onClick={() => setSelectedCompany(null)}
              className="text-sm text-gray-500 hover:text-gray-900 focus:outline-none"
            >
              Clear filter
            </button>
          </div>
        )}
        
        {/* Category filter bar (optional) - will scroll away */}
        {filters.selectedCategories.length > 0 && (
          <div className="bg-white px-6 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="flex items-center flex-wrap gap-2">
              <span className="text-sm text-gray-500">Filtering by categories:</span>
              {filters.selectedCategories.map(category => (
                <span key={category} className="text-sm font-medium text-black bg-gray-100 px-3 py-1 rounded-lg flex items-center">
                  {category}
                  <button 
                    onClick={() => setSelectedCategories(filters.selectedCategories.filter(c => c !== category))}
                    className="ml-2 text-gray-400 hover:text-gray-700 focus:outline-none"
                  >
                    <span className="sr-only">Remove</span>
                    <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </span>
              ))}
            </div>
            <button 
              onClick={() => setSelectedCategories([])}
              className="text-sm text-gray-500 hover:text-gray-900 focus:outline-none"
            >
              Clear filters
            </button>
          </div>
        )}
        
        {/* Table with fixed header and scrollable content */}
        <div className="flex-1 relative">
          {/* Table header - updated to match AnnouncementRow column layout */}
          <div className="sticky top-0 z-10 grid grid-cols-12 px-6 py-3 text-xs font-medium text-gray-500 uppercase bg-gray-50 border-b border-gray-200">
            <div className="col-span-3 flex items-center">
              <span>Company</span>
              <button 
                className="ml-2 p-1 rounded-full hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 focus:outline-none transition-colors"
                onClick={() => openFilterModal('company')}
                title="Filter Companies"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              </button>
            </div>
            <div className="col-span-2 flex items-center">
              <span>Category</span>
              <button 
                className="ml-2 p-1 rounded-full hover:bg-gray-200/60 text-gray-400 hover:text-gray-700 focus:outline-none transition-colors"
                onClick={() => openFilterModal('category')}
                title="Filter Categories"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                </svg>
              </button>
            </div>
            <div className="col-span-5">Summary</div>
            <div className="col-span-1 text-center">Status</div>
            <div className="col-span-1 text-right">Save</div>
          </div>
          
          {/* Table content - scrollable area */}
          <div className="bg-white">
            {isLoading ? (
              <div className="py-16 flex items-center justify-center">
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-black"></div>
              </div>
            ) : error ? (
              <div className="py-16 flex items-center justify-center">
                <div className="text-red-500">{error}</div>
              </div>
            ) : displayedAnnouncements.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center">
                <div className="text-gray-500 mb-4">
                  {showSavedFilings 
                    ? "You don't have any saved filings yet" 
                    : "No announcements match your filters"}
                </div>
                {!showSavedFilings && (
                  <button 
                    className="px-4 py-2 text-sm font-medium text-black bg-gray-100 rounded-lg hover:bg-gray-200"
                    onClick={resetFilters}
                  >
                    Clear all filters
                  </button>
                )}
              </div>
            ) : (
              displayedAnnouncements.map((announcement) => (
                <AnnouncementRow
                  key={announcement.id}
                  announcement={announcement}
                  isSaved={savedFilings.includes(announcement.id)}
                  isViewed={viewedAnnouncements.includes(announcement.id)}
                  onSave={toggleSavedFiling}
                  onClick={handleAnnouncementClick}
                  onCompanyClick={(company, e) => handleCompanyClick(company, e)}
                />
              ))
            )}
          </div>
          
          {/* Pagination controls */}
          {!isLoading && totalItems > 0 && (
            <Pagination 
              currentPage={currentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
            />
          )}
        </div>
      </div>
      
      {/* Overlay when detail panel is open */}
      {selectedDetail && (
        <div 
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-20"
          onClick={() => setSelectedDetail(null)}
        ></div>
      )}
      
      {/* Detail Panel */}
      {selectedDetail && (
        <DetailPanel 
          announcement={selectedDetail}
          isSaved={savedFilings.includes(selectedDetail.id)}
          onClose={() => setSelectedDetail(null)}
          onSave={toggleSavedFiling}
          onViewAllAnnouncements={(company) => {
            // Find a matching announcement to get company details
            const companyAnnouncement = announcements.find(a => a.company === company);
            if (companyAnnouncement) {
              const companyObj: Company = {
                id: companyAnnouncement.companyId,
                name: company,
                symbol: companyAnnouncement.ticker,
                industry: companyAnnouncement.industry,
                isin: companyAnnouncement.isin || ''
              };
              onCompanySelect(companyObj);
            }
          }}
        />
      )}
      
      {/* Filter Modal */}
      {showFilterModal && (
        <FilterModal 
          onClose={() => setShowFilterModal(false)}
          onApplyFilters={(appliedFilters) => {
            if (appliedFilters.categories) {
              setSelectedCategories(appliedFilters.categories);
            }
            if (appliedFilters.sentiments) {
              setSelectedSentiments(appliedFilters.sentiments);
            }
            if (appliedFilters.industries) {
              setSelectedIndustries(appliedFilters.industries);
            }
            setShowFilterModal(false);
          }}
          initialFilters={{
            categories: filters.selectedCategories,
            sentiments: filters.selectedSentiments,
            industries: filters.selectedIndustries,
          }}
          focusTab={filterType === 'category' ? 'categories' : filterType === 'company' ? 'industries' : undefined}
        />
      )}
    </MainLayout>
  );
};

export default Dashboard;
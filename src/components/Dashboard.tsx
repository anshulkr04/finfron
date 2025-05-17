// src/components/Dashboard.tsx - Complete implementation with real-time announcement support

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Search, Calendar, Filter, RefreshCw, AlertTriangle, Star, StarOff, Bell } from 'lucide-react';
import { fetchAnnouncements, ProcessedAnnouncement, Company, searchCompanies, sortAnnouncementsByDate, formatDate } from '../api';
import MainLayout from './layout/MainLayout';
import MetricsPanel from './common/MetricsPanel';
import DetailPanel from './announcements/DetailPanel';
import FilterModal from './common/FilterModal';
import Pagination from './common/Pagination';
import { useFilters } from '../context/FilterContext';
import AnnouncementRow from './announcements/AnnouncementRow';
import { useSocket } from '../context/SocketContext';
import SocketStatusIndicator from './common/SocketStatusIndicator';
import { toast } from 'react-hot-toast';
import NewAnnouncementIndicator from './common/NewAnnouncementIndicator';

// Define an interface for the API search results
interface CompanySearchResult {
  ISIN?: string;
  isin?: string;
  NewName?: string;
  newname?: string;
  OldName?: string;
  oldname?: string;
  NewNSEcode?: string;
  newnsecode?: string;
  OldNSEcode?: string;
  oldnsecode?: string;
  industry?: string;
}

interface DashboardProps {
  onNavigate: (page: 'home' | 'watchlist' | 'company') => void;
  onCompanySelect: (company: Company) => void;
  newAnnouncements?: ProcessedAnnouncement[]; // New prop to receive announcements from App
}

const ITEMS_PER_PAGE = 15; // Number of announcements per page

const Dashboard: React.FC<DashboardProps> = ({ 
  onNavigate, 
  onCompanySelect, 
  newAnnouncements = [] 
}) => {
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
  const [localNewAnnouncements, setLocalNewAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'company' | 'category'>('all');
  const [showNewIndicator, setShowNewIndicator] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  
  // Search-specific state
  const [searchResults, setSearchResults] = useState<CompanySearchResult[]>([]);
  const [isSearchLoading, setIsSearchLoading] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  
  // Refs
  const searchRef = useRef<HTMLDivElement>(null);
  const announcementListRef = useRef<HTMLDivElement>(null);
  const initialLoadComplete = useRef(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const processedAnnouncementIds = useRef<Set<string>>(new Set());
  
  // Access socket context
  const socketContext = useSocket();
  
  // Access filter context
  const { 
    filters, 
    setSearchTerm, 
    setDateRange,
    setSelectedCompany,
    setSelectedCategories,
    setSelectedSentiments,
    setSelectedIndustries
  } = useFilters();
  
  // Function to merge new announcements with existing ones
  const mergeNewAnnouncements = useCallback((
    existingAnnouncements: ProcessedAnnouncement[],
    incomingAnnouncements: ProcessedAnnouncement[]
  ) => {
    if (!incomingAnnouncements || incomingAnnouncements.length === 0) {
      return existingAnnouncements;
    }
    
    // Create a Map of existing announcements by ID for quick lookup
    const existingMap = new Map(existingAnnouncements.map(a => [a.id, a]));
    
    // Process each incoming announcement
    incomingAnnouncements.forEach(incoming => {
      // Check if we already have this announcement
      if (!existingMap.has(incoming.id)) {
        // New announcement - add it to the map
        existingMap.set(incoming.id, {
          ...incoming,
          isNew: true, // Mark as new
          receivedAt: Date.now() // Add timestamp
        });
        console.log(`Added new announcement: ${incoming.id} - ${incoming.company}`);
        
        // Add to processed IDs set
        processedAnnouncementIds.current.add(incoming.id);
      }
    });
    
    // Convert map back to array and sort by date
    return sortAnnouncementsByDate(Array.from(existingMap.values()));
  }, []);

  // Handle marking announcements as read
  const markAnnouncementAsRead = useCallback((id: string) => {
    // Update the viewed announcements list
    if (!viewedAnnouncements.includes(id)) {
      const updatedViewed = [...viewedAnnouncements, id];
      setViewedAnnouncements(updatedViewed);
      localStorage.setItem('viewedAnnouncements', JSON.stringify(updatedViewed));
    }
    
    // Update the newAnnouncements state by removing this announcement
    setLocalNewAnnouncements(prev => prev.filter(a => a.id !== id));
    
    // Update the main announcements list to remove the isNew flag
    setAnnouncements(prev => prev.map(announcement => 
      announcement.id === id 
        ? { ...announcement, isNew: false } 
        : announcement
    ));
  }, [viewedAnnouncements]);

  // Handle announcement click
  const handleAnnouncementClick = (announcement: ProcessedAnnouncement) => {
    // Mark as viewed when clicked
    markAnnouncementAsRead(announcement.id);
    
    // Show the detail panel
    setSelectedDetail(announcement);
  };
  
  // Handle new announcements from parent App component
  useEffect(() => {
    if (newAnnouncements && newAnnouncements.length > 0) {
      console.log(`Dashboard received ${newAnnouncements.length} new announcements from App`);
      
      // Merge with existing announcements
      setAnnouncements(prev => mergeNewAnnouncements(prev, newAnnouncements));
      
      // Update local new announcements count
      const newIds = new Set(newAnnouncements.map(a => a.id));
      setLocalNewAnnouncements(prev => {
        // Remove announcements that are no longer marked as new
        const filtered = prev.filter(a => a.isNew);
        
        // Add new announcements that we haven't processed yet
        const newOnes = newAnnouncements.filter(a => 
          !prev.some(p => p.id === a.id) && a.isNew
        );
        
        return [...filtered, ...newOnes];
      });
      
      // Show the new indicator
      setShowNewIndicator(true);
      
      // Reset to first page to show new announcements
      setCurrentPage(1);
    }
  }, [newAnnouncements, mergeNewAnnouncements]);
  
  // Listen directly for new announcements from the socket via custom event
  useEffect(() => {
    const handleNewAnnouncementEvent = (event: CustomEvent) => {
      if (event.detail) {
        const newAnnouncement = event.detail as ProcessedAnnouncement;
        console.log("Dashboard received new announcement from custom event:", newAnnouncement);
        
        // Check if we've already processed this announcement
        if (processedAnnouncementIds.current.has(newAnnouncement.id)) {
          console.log(`Already processed announcement ${newAnnouncement.id}, skipping`);
          return;
        }
        
        // Add to processed IDs
        processedAnnouncementIds.current.add(newAnnouncement.id);
        
        // Update the announcements list
        setAnnouncements(prev => {
          // Skip if already in the list
          if (prev.some(a => a.id === newAnnouncement.id)) {
            return prev;
          }
          
          // Add to the beginning and re-sort
          const updated = [newAnnouncement, ...prev];
          return sortAnnouncementsByDate(updated);
        });
        
        // Also update the newAnnouncements state
        setLocalNewAnnouncements(prev => {
          // Skip if already in the list
          if (prev.some(a => a.id === newAnnouncement.id)) {
            return prev;
          }
          
          return [newAnnouncement, ...prev];
        });
        
        // Show the indicator
        setShowNewIndicator(true);
      }
    };
    
    // Listen for the custom event
    window.addEventListener('new-announcement-received', handleNewAnnouncementEvent as EventListener);
    
    return () => {
      window.removeEventListener('new-announcement-received', handleNewAnnouncementEvent as EventListener);
    };
  }, []);
  
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
  
  // Function to handle manual refresh/retry
  const handleRetry = useCallback(() => {
    console.log("Manual retry initiated");
    setIsRetrying(true);
    setIsLoading(true);
    
    // Retry socket connection if there's an error
    if (socketContext && socketContext.connectionStatus === 'error') {
      socketContext.reconnect();
    }
    
    // Load announcements again
    loadAnnouncements();
    
    // Set a timeout to reset the retrying state
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }
    
    retryTimeoutRef.current = setTimeout(() => {
      setIsRetrying(false);
    }, 3000);
  }, [socketContext]);
  
  // Enhanced announcement loading function
  const loadAnnouncements = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    // Set a timeout to show loading state for at least 500ms
    // This prevents flickering for fast responses
    if (loadingTimeoutRef.current) {
      clearTimeout(loadingTimeoutRef.current);
    }
    
    const minLoadingTime = new Promise(resolve => {
      loadingTimeoutRef.current = setTimeout(resolve, 500);
    });
    
    try {
      console.log("Fetching announcements from API...");
      // Check if dates are valid before fetching
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      const startDate = dateRegex.test(filters.dateRange.start) ? filters.dateRange.start : '';
      const endDate = dateRegex.test(filters.dateRange.end) ? filters.dateRange.end : '';
      
      const industry = filters.selectedIndustries.length === 1 ? filters.selectedIndustries[0] : '';
      const data = await fetchAnnouncements(startDate, endDate, industry);
      
      // Wait for minimum loading time to complete
      await minLoadingTime;
      
      console.log(`Received ${data.length} announcements from API`);
      
      // Add all IDs to processed set
      data.forEach(announcement => {
        processedAnnouncementIds.current.add(announcement.id);
      });
      
      // Merge with any new announcements we've received via socket
      if (localNewAnnouncements && localNewAnnouncements.length > 0) {
        const mergedData = mergeNewAnnouncements(data, localNewAnnouncements);
        setAnnouncements(mergedData);
      } else {
        setAnnouncements(data);
      }
      
      // Mark initial load as complete
      initialLoadComplete.current = true;
      
      // Reset to first page when data changes
      setCurrentPage(1);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to load announcements. Please try again.');
      
      // If fetch fails but we have test data in our announcements state already, keep it
      if (announcements.length === 0) {
        // Generate test data since we have nothing to show
        console.log("Generating test data as fallback");
        const testData = generateTestData(3);
        setAnnouncements(testData);
      }
    } finally {
      await minLoadingTime; // Always wait for min loading time
      setIsLoading(false);
      setIsRetrying(false);
    }
  }, [filters.dateRange, filters.selectedIndustries, mergeNewAnnouncements, localNewAnnouncements]);
  
  // Generate test data as fallback
  const generateTestData = (count: number): ProcessedAnnouncement[] => {
    const testData: ProcessedAnnouncement[] = [];
    const categories = ["Financial Results", "Dividend", "Mergers & Acquisitions"];
    const sentiments = ["Positive", "Negative", "Neutral"];
    
    for (let i = 0; i < count; i++) {
      const categoryIndex = i % categories.length;
      const sentimentIndex = i % sentiments.length;
      const category = categories[categoryIndex];
      
      // Create test data with formatting
      const headline = `Test Announcement ${i+1} for ${category}`;
      const summary = `**Category:** ${category}\n**Headline:** ${headline}\n\nThis is a test announcement ${i+1} for debugging purposes.`;
      
      const now = new Date();
      const date = new Date(now.getTime() - (i * 3600000)); // Each test item 1 hour apart
      
      testData.push({
        id: `test-${i}-${Date.now()}`,
        company: `Test Company ${i + 1}`,
        ticker: `TC${i+1}`,
        category: categories[categoryIndex],
        sentiment: sentiments[sentimentIndex],
        date: date.toISOString(),
        displayDate: formatDate(date.toISOString()),
        summary: summary,
        detailedContent: `${summary}\n\n## Additional Details\n\nThis is a detailed content for test announcement ${i+1}.`,
        isin: `TEST${i}1234567890`
      });
    }
    
    return testData;
  };
  
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
        (item.ticker && item.ticker.toLowerCase().includes(filters.searchTerm.toLowerCase())) ||
        (item.isin && item.isin.toLowerCase().includes(filters.searchTerm.toLowerCase()))
      );
    }
    
    if (filters.selectedCategories.length > 0) {
      result = result.filter(item => filters.selectedCategories.includes(item.category));
    }
    
    if (filters.selectedSentiments.length > 0) {
      result = result.filter(item => item.sentiment && filters.selectedSentiments.includes(item.sentiment));
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
  
  // Load announcements on mount and when filters change
  useEffect(() => {
    loadAnnouncements();
    
    return () => {
      // Clear any timers on unmount
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (loadingTimeoutRef.current) {
        clearTimeout(loadingTimeoutRef.current);
      }
    };
  }, [loadAnnouncements]);
  
  // Join relevant rooms based on filters when socket is connected
  useEffect(() => {
    if (socketContext && socketContext.isConnected) {
      console.log('Joining socket rooms based on filters');
      
      // Join the 'all' room to receive all announcements
      socketContext.joinRoom('all');
      
      // Join rooms for filtered companies
      if (filters.selectedCompany) {
        socketContext.joinRoom(`company:${filters.selectedCompany}`);
      }
      
      // Join specific industry or category rooms if we want to track these
      if (filters.selectedIndustries.length === 1) {
        socketContext.joinRoom(`industry:${filters.selectedIndustries[0]}`);
      }
      
      if (filters.selectedCategories.length > 0) {
        filters.selectedCategories.forEach(category => {
          socketContext.joinRoom(`category:${category}`);
        });
      }
      
      // Join symbol/ticker-specific rooms from announcements
      const tickers = announcements
        .map(a => a.ticker)
        .filter(Boolean)
        .filter((ticker, index, self) => self.indexOf(ticker) === index);
        
      tickers.forEach(ticker => {
        if (ticker) socketContext.joinRoom(ticker);
      });
      
      // Join ISIN-specific rooms from announcements
      const isins = announcements
        .map(a => a.isin)
        .filter(Boolean)
        .filter((isin, index, self) => self.indexOf(isin) === index);
        
      isins.forEach(isin => {
        if (isin) socketContext.joinRoom(isin);
      });
      
      // Clean up function to leave rooms when component unmounts or filters change
      return () => {
        socketContext.leaveRoom('all');
        
        if (filters.selectedCompany) {
          socketContext.leaveRoom(`company:${filters.selectedCompany}`);
        }
        
        if (filters.selectedIndustries.length === 1) {
          socketContext.leaveRoom(`industry:${filters.selectedIndustries[0]}`);
        }
        
        if (filters.selectedCategories.length > 0) {
          filters.selectedCategories.forEach(category => {
            socketContext.leaveRoom(`category:${category}`);
          });
        }
        
        tickers.forEach(ticker => {
          if (ticker) socketContext.leaveRoom(ticker);
        });
        
        isins.forEach(isin => {
          if (isin) socketContext.leaveRoom(isin);
        });
      };
    }
  }, [
    socketContext, 
    socketContext?.isConnected, 
    filters.selectedCompany,
    filters.selectedIndustries,
    filters.selectedCategories,
    announcements // Add this dependency to update rooms when announcements change
  ]);
  
  // Handle search input changes with debouncing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (filters.searchTerm && filters.searchTerm.length >= 2) {
        const performSearch = async () => {
          setIsSearchLoading(true);
          try {
            const results = await searchCompanies(filters.searchTerm, 5);
            setSearchResults(results);
            if (results.length > 0) {
              setShowSearchResults(true);
            }
          } catch (err) {
            console.error('Search error:', err);
          } finally {
            setIsSearchLoading(false);
          }
        };
        
        performSearch();
      } else {
        setShowSearchResults(false);
      }
    }, 300); // Debounce for 300ms
    
    return () => clearTimeout(timer);
  }, [filters.searchTerm]);
  
  // Handle click outside search results
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
  
  // Handle search result selection
  const handleSearchSelect = (companyData: CompanySearchResult) => {
    // Create a Company object from the API response
    const company: Company = {
      id: companyData.ISIN || companyData.isin || `company-${Date.now()}`,
      name: companyData.NewName || companyData.newname || companyData.OldName || companyData.oldname || '',
      symbol: companyData.NewNSEcode || companyData.newnsecode || companyData.OldNSEcode || companyData.oldnsecode || '',
      isin: companyData.ISIN || companyData.isin || '',
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
    if (announcementListRef.current) {
      announcementListRef.current.scrollTop = 0;
    } else {
      window.scrollTo({
        top: 0,
        behavior: 'smooth'
      });
    }
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
  
  // Handle scroll to new announcements
  const handleScrollToNew = () => {
    setCurrentPage(1); // Reset to first page
    setShowNewIndicator(false); // Hide indicator
    
    // After state update, scroll to top where new announcements are
    setTimeout(() => {
      if (announcementListRef.current) {
        announcementListRef.current.scrollTop = 0;
      } else {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    }, 100);
  };
  
  // Render socket connection error message if needed
  const renderConnectionError = () => {
    if (!socketContext || socketContext.connectionStatus === 'error') {
      return (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-4">
          <div className="flex items-center">
            <AlertTriangle className="h-5 w-5 text-red-400 mr-2" />
            <p className="text-sm text-red-700">
              Live updates are currently unavailable. 
              <button 
                onClick={handleRetry}
                className="ml-2 text-red-900 underline hover:no-underline focus:outline-none"
                disabled={isRetrying}
              >
                {isRetrying ? 'Reconnecting...' : 'Reconnect'}
              </button>
            </p>
          </div>
        </div>
      );
    }
    return null;
  };
  
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
                  key={company.ISIN || company.isin || `result-${index}`} 
                  className="p-3 hover:bg-gray-50 cursor-pointer transition-colors"
                  onClick={() => handleSearchSelect(company)}
                >
                  <div className="font-medium text-gray-900">
                    {company.NewName || company.newname || company.OldName || company.oldname}
                  </div>
                  <div className="flex flex-wrap items-center mt-1 gap-2">
                    {(company.NewNSEcode || company.newnsecode || company.OldNSEcode || company.oldnsecode) && (
                      <span className="text-xs font-semibold bg-gray-100 text-gray-800 px-2 py-0.5 rounded-md">
                        {company.NewNSEcode || company.newnsecode || company.OldNSEcode || company.oldnsecode}
                      </span>
                    )}
                    {(company.ISIN || company.isin) && (
                      <span className="text-xs font-semibold bg-blue-50 text-blue-800 px-2 py-0.5 rounded-md">
                        ISIN: {company.ISIN || company.isin}
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
  
  // Render the dashboard header
  const renderDashboardHeader = () => (
    <div className="py-4 px-6 bg-white border-b border-gray-100 flex justify-between items-center">
      <div className="flex items-center">
        <h1 className="text-xl font-semibold text-gray-900">Announcements Dashboard</h1>
        <div className="ml-3 flex items-center">
          <div className="w-2 h-2 bg-green-500 rounded-full mr-1.5"></div>
          <span className="text-xs font-medium text-gray-700">AI-Powered</span>
        </div>
        <SocketStatusIndicator className="ml-3" />
        
        {/* Retry button visible when error or loading */}
        {(error || (socketContext && socketContext.connectionStatus === 'error')) && (
          <button
            onClick={handleRetry}
            disabled={isRetrying || isLoading}
            className="ml-4 flex items-center px-2 py-1 text-xs font-medium rounded border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw size={12} className={`mr-1 ${isRetrying ? 'animate-spin' : ''}`} />
            {isRetrying ? 'Retrying...' : 'Retry'}
          </button>
        )}
      </div>
      
      <div className="flex items-center">
        <div className="mr-6 text-sm font-medium">
          Filtered Announcements: {filteredAnnouncements.length}
        </div>
        {localNewAnnouncements.length > 0 && (
          <div className="flex items-center text-sm font-medium text-blue-600">
            <div className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-2 badge-pulse"></div>
            {localNewAnnouncements.length} new update{localNewAnnouncements.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
  
  // Main render
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
        {/* Custom dashboard header with retry button */}
        {renderDashboardHeader()}
        
        {/* Connection error message if needed */}
        {renderConnectionError()}
        
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
        <div className="flex-1 relative" ref={announcementListRef}>
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
            <div className="col-span-1 text-right">Actions</div>
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
                <button
                  onClick={handleRetry}
                  className="ml-3 px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg flex items-center"
                >
                  <RefreshCw size={16} className="mr-2" />
                  Retry
                </button>
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
                  onCompanyClick={handleCompanyClick}
                  isNew={localNewAnnouncements.some(a => a.id === announcement.id)}
                  onMarkAsRead={markAnnouncementAsRead}
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
      
      {/* New announcements floating indicator */}
      {showNewIndicator && localNewAnnouncements.length > 0 && (
        <div className="fixed bottom-6 right-6 z-50 scale-in-animation">
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded-full shadow-lg flex items-center transition-colors"
            onClick={handleScrollToNew}
            aria-label={`${localNewAnnouncements.length} new announcements, click to view`}
          >
            <span className="badge-pulse mr-2 flex items-center justify-center">
              <Bell size={16} />
            </span>
            <span className="font-medium mr-1">{localNewAnnouncements.length} new announcement{localNewAnnouncements.length !== 1 ? 's' : ''}</span>
            <span className="ml-1">↑</span>
          </button>
        </div>
      )}
    </MainLayout>
  );
};

export default Dashboard;
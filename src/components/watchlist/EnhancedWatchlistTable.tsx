import React, { useState, useEffect, useCallback } from 'react';
import { Star, ArrowDown, ArrowUp, Eye, ExternalLink, AlertCircle, Search, Trash2, AlertTriangle, Filter, ArrowDownUp } from 'lucide-react';
import { Company } from '../../api';
import { useWatchlist } from '../../context/WatchlistContext';

interface EnhancedWatchlistTableProps {
  watchlistId: string;
  onViewAnnouncements: (company: Company) => void;
}

const EnhancedWatchlistTable: React.FC<EnhancedWatchlistTableProps> = ({ watchlistId, onViewAnnouncements }) => {
  const { getWatchlistById, removeFromWatchlist, watchlists } = useWatchlist();
  const [sortField, setSortField] = useState<'name' | 'symbol' | 'industry'>('name');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchTerm, setSearchTerm] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [watchlistCompanies, setWatchlistCompanies] = useState<Company[]>([]);
  
  // Get watchlist companies and keep them in local state
  // The key fix: Added watchlists to the dependency array so component updates when watchlists change
  useEffect(() => {
    const watchlist = getWatchlistById(watchlistId);
    if (watchlist) {
      setWatchlistCompanies(watchlist.companies);
    }
  }, [watchlistId, getWatchlistById, watchlists]); // Added watchlists to dependency array

  // Filter companies based on search term
  const filteredCompanies = watchlistCompanies.filter(company => 
    company.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    company.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (company.industry && company.industry.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  
  // Sort companies
  const sortedCompanies = [...filteredCompanies].sort((a, b) => {
    const aValue = a[sortField]?.toLowerCase() || '';
    const bValue = b[sortField]?.toLowerCase() || '';
    
    if (sortDirection === 'asc') {
      return aValue.localeCompare(bValue);
    } else {
      return bValue.localeCompare(aValue);
    }
  });
  
  const handleSort = (field: 'name' | 'symbol' | 'industry') => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };
  
  // Improved delete handler
  const handleDelete = useCallback((id: string, e: React.MouseEvent) => {
    // Stop event propagation and prevent default behavior
    e.stopPropagation();
    e.preventDefault();
    
    console.log(`Delete button clicked for company ID: ${id}`);
    console.log(`Current watchlist ID: ${watchlistId}`);
    
    if (confirmDelete === id) {
      console.log(`Removing company ${id} from watchlist ${watchlistId}`);
      
      try {
        // Call the context function to remove from global state
        removeFromWatchlist(id, watchlistId);
        
        // Reset confirmation state
        setConfirmDelete(null);
      } catch (error) {
        console.error("Error deleting company:", error);
      }
    } else {
      console.log('Setting confirm delete state');
      setConfirmDelete(id);
      // Auto-cancel after 3 seconds
      setTimeout(() => {
        setConfirmDelete(null);
      }, 3000);
    }
  }, [confirmDelete, removeFromWatchlist, watchlistId]);
  
  // Handle click on company name - redirect to company page
  const handleCompanyClick = (company: Company) => {
    onViewAnnouncements(company);
  };
  
  // Click outside handler to cancel delete confirmation
  useEffect(() => {
    const handleClickOutside = () => {
      setConfirmDelete(null);
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Get a color for category/industry
  const getCategoryColor = (industry: string) => {
    const colors = {
      'Technology': 'bg-blue-100 text-blue-800',
      'Automotive': 'bg-green-100 text-green-800',
      'Financial': 'bg-amber-100 text-amber-800',
      'Healthcare': 'bg-rose-100 text-rose-800',
      'Energy': 'bg-purple-100 text-purple-800',
      'Consumer': 'bg-teal-100 text-teal-800',
      'Industrial': 'bg-indigo-100 text-indigo-800',
      'Materials': 'bg-orange-100 text-orange-800',
      'Utilities': 'bg-sky-100 text-sky-800',
      'Real Estate': 'bg-emerald-100 text-emerald-800',
      'Telecommunication': 'bg-violet-100 text-violet-800'
    };
    
    for (const [key, value] of Object.entries(colors)) {
      if (industry.toLowerCase().includes(key.toLowerCase())) {
        return value;
      }
    }
    
    return 'bg-gray-100 text-gray-800';
  };
  
  // Render a company card
  const renderCompanyCard = (company: Company) => {
    const categoryColor = company.industry ? getCategoryColor(company.industry) : 'bg-gray-100 text-gray-800';
    
    return (
      <div 
        key={company.id} 
        className="group relative bg-white rounded-xl border border-gray-100 hover:border-indigo-200 hover:shadow-md transition-all duration-200 overflow-hidden cursor-pointer"
      >
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-semibold text-gray-900">{company.symbol}</span>
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${categoryColor}`}>
                  {company.industry || 'Not specified'}
                </span>
              </div>
              <h3 className="text-base font-medium text-gray-800 line-clamp-1">{company.name}</h3>
            </div>
          </div>
        </div>
        
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
          <div className="flex space-x-2">
            <button 
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                handleCompanyClick(company);
              }}
              title="View Company Details"
            >
              <Eye size={16} />
            </button>
            <a 
              href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(company.symbol)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              title="View on NSE"
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink size={16} />
            </a>
          </div>
          <button 
            className={`p-1.5 rounded-lg ${
              confirmDelete === company.id 
                ? 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                : 'hover:bg-gray-100 text-gray-400 hover:text-rose-500'
            } transition-colors`}
            onClick={(e) => handleDelete(company.id, e)}
            title={confirmDelete === company.id ? "Click again to confirm" : "Remove from Watchlist"}
          >
            {confirmDelete === company.id ? (
              <Trash2 size={16} className="text-rose-500" />
            ) : (
              <Star size={16} className="fill-current" />
            )}
          </button>
        </div>
      </div>
    );
  };
  
  // Show empty state if no companies
  if (watchlistCompanies.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-12 text-center">
        <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center mx-auto mb-4">
          <AlertCircle size={28} className="text-gray-400" />
        </div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Your watchlist is empty</h3>
        <p className="text-gray-600 max-w-md mx-auto mb-6">
          Add companies to your watchlist to track their announcements and filings in one place.
        </p>
      </div>
    );
  }
  
  return (
    <div>
      {/* Search and view controls */}
      <div className="flex justify-between items-center mb-6 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
        <div className="relative w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Filter companies..."
            className="pl-10 pr-4 py-2 w-full bg-gray-50 border-none rounded-lg text-sm focus:ring-2 focus:ring-indigo-100 focus:bg-white transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <div className="flex items-center space-x-3">
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-500">Sort:</span>
            <button
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center space-x-1 ${sortField === 'name' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
              onClick={() => handleSort('name')}
            >
              <span>Name</span>
              {sortField === 'name' && (
                sortDirection === 'asc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />
              )}
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center space-x-1 ${sortField === 'symbol' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
              onClick={() => handleSort('symbol')}
            >
              <span>Symbol</span>
              {sortField === 'symbol' && (
                sortDirection === 'asc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />
              )}
            </button>
            <button
              className={`px-3 py-1.5 text-sm rounded-lg flex items-center space-x-1 ${sortField === 'industry' ? 'bg-indigo-50 text-indigo-700' : 'text-gray-700 hover:bg-gray-50'}`}
              onClick={() => handleSort('industry')}
            >
              <span>Industry</span>
              {sortField === 'industry' && (
                sortDirection === 'asc' ? <ArrowDown size={14} /> : <ArrowUp size={14} />
              )}
            </button>
          </div>
          
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button
              className={`p-2 ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
                <rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="2" />
              </svg>
            </button>
            <button
              className={`p-2 ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 6H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 12H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M8 18H21" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 6H3.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 12H3.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M3 18H3.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
      
      {/* No results state */}
      {searchTerm && filteredCompanies.length === 0 && (
        <div className="bg-white rounded-xl shadow-sm p-8 text-center">
          <AlertTriangle size={28} className="mx-auto mb-3 text-amber-400" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No matching companies</h3>
          <p className="text-gray-600">
            No companies match your search criteria. Try adjusting your filters.
          </p>
        </div>
      )}
      
      {/* Grid view */}
      {filteredCompanies.length > 0 && viewMode === 'grid' && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sortedCompanies.map(company => (
            <div key={company.id} onClick={() => handleCompanyClick(company)}>
              {renderCompanyCard(company)}
            </div>
          ))}
        </div>
      )}
      
      {/* List view */}
      {filteredCompanies.length > 0 && viewMode === 'list' && (
        <div className="bg-white rounded-xl shadow-sm overflow-hidden">
          {/* Table Header */}
          <div className="grid grid-cols-12 px-6 py-3 border-b border-gray-100 text-xs font-medium text-gray-500 uppercase bg-gray-50">
            <div 
              className="col-span-5 flex items-center cursor-pointer"
              onClick={() => handleSort('name')}
            >
              <span>Company</span>
              {sortField === 'name' && (
                <span className="ml-2">
                  {sortDirection === 'asc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                </span>
              )}
            </div>
            <div 
              className="col-span-2 flex items-center cursor-pointer"
              onClick={() => handleSort('symbol')}
            >
              <span>Symbol</span>
              {sortField === 'symbol' && (
                <span className="ml-2">
                  {sortDirection === 'asc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                </span>
              )}
            </div>
            <div 
              className="col-span-3 flex items-center cursor-pointer"
              onClick={() => handleSort('industry')}
            >
              <span>Industry</span>
              {sortField === 'industry' && (
                <span className="ml-2">
                  {sortDirection === 'asc' ? <ArrowDown size={12} /> : <ArrowUp size={12} />}
                </span>
              )}
            </div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          
          {/* Table Content */}
          <div className="divide-y divide-gray-100">
            {sortedCompanies.map((company) => (
              <div 
                key={company.id} 
                className="grid grid-cols-12 px-6 py-4 hover:bg-gray-50 transition-colors items-center group"
                onClick={() => handleCompanyClick(company)}
              >
                <div className="col-span-5 font-medium text-gray-900 truncate group-hover:text-indigo-600 transition-colors">
                  {company.name}
                </div>
                <div className="col-span-2 text-gray-600">{company.symbol}</div>
                <div className="col-span-3">
                  {company.industry && (
                    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getCategoryColor(company.industry)}`}>
                      {company.industry}
                    </span>
                  )}
                </div>
                <div className="col-span-2 flex items-center justify-end space-x-1">
                  <button 
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCompanyClick(company);
                    }}
                    title="View Company Details"
                  >
                    <Eye size={16} />
                  </button>
                  <a 
                    href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(company.symbol)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
                    title="View on NSE"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button 
                    className={`p-2 rounded-lg ${
                      confirmDelete === company.id 
                        ? 'bg-rose-50 text-rose-500 hover:bg-rose-100'
                        : 'hover:bg-gray-100 text-gray-400 hover:text-rose-500'
                    } transition-colors`}
                    onClick={(e) => handleDelete(company.id, e)}
                    title={confirmDelete === company.id ? "Click again to confirm" : "Remove from Watchlist"}
                  >
                    {confirmDelete === company.id ? (
                      <Trash2 size={16} className="text-rose-500" />
                    ) : (
                      <Star size={16} className="fill-current" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default EnhancedWatchlistTable;
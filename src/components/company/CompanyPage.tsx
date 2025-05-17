import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Star, Check, ExternalLink, Calendar, 
  BarChart2, FileText, Info, Users, Tag, Briefcase
} from 'lucide-react';
import MainLayout from '../layout/MainLayout';
import { fetchAnnouncements, ProcessedAnnouncement, Company } from '../../api';
import AnnouncementList from '../announcements/AnnouncementList';
import DetailPanel from '../announcements/DetailPanel';
import { useWatchlist } from '../../context/WatchlistContext';
import { useFilters } from '../../context/FilterContext';
import angelOneService from '../../services/angelOneService';
import StockPriceChart from './StockPriceChart';
import CreateWatchlistModal from '../watchlist/CreateWatchlistModal.tsx';

interface CompanyPageProps {
  company: Company;
  onNavigate: (page: 'home' | 'watchlist' | 'company', params?: any) => void;
  onBack: () => void;
}

type TabType = 'overview' | 'financials' | 'announcements' | 'about';

const CompanyPage: React.FC<CompanyPageProps> = ({ company, onNavigate, onBack }) => {
  // State management
  const [announcements, setAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const [selectedDetail, setSelectedDetail] = useState<ProcessedAnnouncement | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savedFilings, setSavedFilings] = useState<string[]>([]);
  const [showSavedFilings, setShowSavedFilings] = useState(false);
  const [stockInfo, setStockInfo] = useState<any | null>(null);
  const [companyProfile, setCompanyProfile] = useState<any | null>(null);
  const [watchlistDropdownOpen, setWatchlistDropdownOpen] = useState(false);
  const [showCreateWatchlistModal, setShowCreateWatchlistModal] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  
  const { 
    watchlists, 
    addToWatchlist, 
    isWatched, 
    createWatchlist
  } = useWatchlist();
  
  const { filters, setSearchTerm, setDateRange, setSelectedCompany } = useFilters();
  
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
  
  // Fetch announcements for this company
  useEffect(() => {
    const loadAnnouncements = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const data = await fetchAnnouncements(filters.dateRange.start, filters.dateRange.end);
        // Filter for this company only
        const companyAnnouncements = data.filter(item => 
          item.company === company.name || item.ticker === company.symbol
        );
        setAnnouncements(companyAnnouncements);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load announcements. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAnnouncements();
  }, [company, filters.dateRange]);
  
  // Fetch stock information
  useEffect(() => {
    const loadStockInfo = async () => {
      try {
        const quote = await angelOneService.getQuote(company.symbol);
        if (quote) {
          setStockInfo(quote);
        }
        
        const profile = await angelOneService.getCompanyProfile(company.symbol);
        if (profile) {
          setCompanyProfile(profile);
        }
      } catch (error) {
        console.error('Error fetching stock information:', error);
      }
    };
    
    loadStockInfo();
  }, [company]);
  
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
  
  // Handle announcement click
  const handleAnnouncementClick = (announcement: ProcessedAnnouncement) => {
    setSelectedDetail(announcement);
  };
  
  // Format large numbers with commas and abbreviations
  const formatNumber = (num: number): string => {
    if (num >= 1000000000) {
      return (num / 1000000000).toFixed(2) + 'B';
    }
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + 'M';
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(2) + 'K';
    }
    return num.toString();
  };
  
  // Handle adding company to a specific watchlist
  const handleAddToWatchlist = (watchlistId: string) => {
    addToWatchlist(company, watchlistId);
    setWatchlistDropdownOpen(false);
  };
  
  // Handle creating a new watchlist and adding the company to it
  const handleCreateWatchlist = (name: string) => {
    const newWatchlist = createWatchlist(name);
    addToWatchlist(company, newWatchlist.id);
    setShowCreateWatchlistModal(false);
    setWatchlistDropdownOpen(false);
  };
  
  // Calculate styling based on percentage change
  const getChangeColor = (change: number) => {
    if (change > 0) return 'text-emerald-600';
    if (change < 0) return 'text-rose-600';
    return 'text-gray-600';
  };

  // Tab definitions
  const tabs: Array<{id: TabType, label: string, icon: React.ReactNode}> = [
    { id: 'overview', label: 'Overview', icon: <BarChart2 size={16} /> },
    { id: 'financials', label: 'Financials', icon: <FileText size={16} /> },
    { id: 'announcements', label: 'Announcements', icon: <Info size={16} /> },
    { id: 'about', label: 'About', icon: <Briefcase size={16} /> },
  ];
  
  // Create header right content
  const headerRight = (
    <div className="flex items-center space-x-4">
      <div className="relative">
        <button
          className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium bg-black text-white hover:bg-gray-900"
          onClick={() => setWatchlistDropdownOpen(!watchlistDropdownOpen)}
        >
          <Star size={16} className={isWatched(company.id) ? "fill-current" : ""} />
          <span>{isWatched(company.id) ? "In Watchlist" : "Add to Watchlist"}</span>
        </button>
        
        {watchlistDropdownOpen && (
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-float border border-gray-100 z-30 overflow-hidden">
            <div className="py-2">
              <div className="px-4 py-2 text-xs font-medium text-gray-500 uppercase">
                Your Watchlists
              </div>
              
              {watchlists.map(watchlist => {
                const isInWatchlist = isWatched(company.id, watchlist.id);
                
                return (
                  <button
                    key={watchlist.id}
                    className="flex items-center justify-between w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    onClick={() => handleAddToWatchlist(watchlist.id)}
                    disabled={isInWatchlist}
                  >
                    <div className="flex items-center">
                      <Star size={16} className={`mr-2 ${isInWatchlist ? 'text-amber-500 fill-current' : ''}`} />
                      <span>{watchlist.name}</span>
                    </div>
                    {isInWatchlist && <Check size={16} className="text-emerald-500" />}
                  </button>
                );
              })}
              
              <div className="border-t border-gray-100 my-1"></div>
              
              <button
                className="flex items-center w-full px-4 py-2 text-sm text-black font-medium hover:bg-gray-50"
                onClick={() => {
                  setShowCreateWatchlistModal(true);
                  setWatchlistDropdownOpen(false);
                }}
              >
                <Star size={16} className="mr-2" />
                <span>Create New Watchlist</span>
              </button>
            </div>
          </div>
        )}
      </div>
      
      <a
        href={`https://www.nseindia.com/get-quotes/equity?symbol=${encodeURIComponent(company.symbol)}`}
        target="_blank"
        rel="noopener noreferrer" 
        className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 text-gray-700 hover:bg-gray-50"
      >
        <ExternalLink size={16} />
        <span>View on NSE</span>
      </a>
    </div>
  );
  
  return (
    <MainLayout
      activePage="company"
      selectedCompany={company.name}
      setSelectedCompany={setSelectedCompany}
      headerRight={headerRight}
      onNavigate={onNavigate}
    >
      <div className="flex flex-col h-full overflow-auto">
        {/* Company header with key metrics */}
        <div className="bg-white border-b border-gray-100 px-6 py-6">
          <div className="flex items-center mb-6">
            <button
              className="mr-4 p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-900"
              onClick={onBack}
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">{company.name}</h1>
              <div className="flex items-center mt-1">
                <span className="px-2.5 py-0.5 text-sm font-medium rounded-full bg-black text-white">{company.symbol}</span>
                {company.industry && (
                  <span className="ml-2 px-2.5 py-0.5 text-sm font-medium rounded-full bg-gray-100 text-gray-800">
                    {company.industry}
                  </span>
                )}
              </div>
            </div>
            
            {stockInfo && (
              <div className="ml-auto flex items-end">
                <div className="text-right">
                  <div className="text-3xl font-bold">₹{stockInfo.ltp.toFixed(2)}</div>
                  <div className={`flex items-center justify-end mt-1 ${getChangeColor(stockInfo.percentageChange)}`}>
                    <span className="text-sm font-medium">
                      {stockInfo.percentageChange > 0 ? '+' : ''}{stockInfo.percentageChange}%
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* Tabs navigation */}
          <div className="border-b border-gray-200">
            <div className="flex space-x-1">
              {tabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-3 px-4 flex items-center space-x-2 text-sm font-medium transition-all duration-200 ${
                    activeTab === tab.id 
                      ? 'text-black border-b-2 border-black' 
                      : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50 rounded-t-lg'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Tab content */}
        <div className="bg-gray-50 flex-1 p-6">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              {/* Chart section */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                <StockPriceChart symbol={company.symbol} />
              </div>
              
              {/* Key metrics section */}
              {stockInfo && (
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Today's Range</h3>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-500">Low</span>
                      <span className="text-sm text-gray-500">High</span>
                    </div>
                    <div className="relative h-2 bg-gray-100 rounded-full mb-2">
                      <div 
                        className="absolute h-2 bg-black rounded-full" 
                        style={{ 
                          left: `${((stockInfo.ltp - stockInfo.low) / (stockInfo.high - stockInfo.low)) * 100}%`,
                          width: '4px',
                          transform: 'translateX(-50%)'
                        }}
                      ></div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">₹{stockInfo.low.toFixed(2)}</span>
                      <span className="text-sm font-medium">₹{stockInfo.high.toFixed(2)}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Previous Close</h3>
                    <div className="text-lg font-medium">₹{stockInfo.close.toFixed(2)}</div>
                    <div className="mt-2 text-xs text-gray-500">
                      {stockInfo.ltp > stockInfo.close ? (
                        <span className="text-emerald-600">
                          +₹{(stockInfo.ltp - stockInfo.close).toFixed(2)} today
                        </span>
                      ) : (
                        <span className="text-rose-600">
                          -₹{(stockInfo.close - stockInfo.ltp).toFixed(2)} today
                        </span>
                      )}
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-sm font-medium text-gray-500 mb-2">Volume</h3>
                    <div className="text-lg font-medium">{stockInfo.volume.toLocaleString()}</div>
                    <div className="mt-2 text-xs text-gray-500">
                      As of {new Date().toLocaleTimeString()}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Additional metrics section */}
              {stockInfo && (
                <div className="grid grid-cols-4 gap-4 mt-4">
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-xs font-medium text-gray-500 mb-1">Market Cap</h3>
                    <div className="text-lg font-medium">₹{formatNumber(stockInfo.marketCap || 0)}</div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-xs font-medium text-gray-500 mb-1">P/E Ratio</h3>
                    <div className="text-lg font-medium">{(stockInfo.pe || 0).toFixed(2)}</div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-xs font-medium text-gray-500 mb-1">EPS</h3>
                    <div className="text-lg font-medium">₹{(stockInfo.eps || 0).toFixed(2)}</div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                    <h3 className="text-xs font-medium text-gray-500 mb-1">Book Value</h3>
                    <div className="text-lg font-medium">₹{(stockInfo.bookValue || 0).toFixed(2)}</div>
                  </div>
                </div>
              )}
              
              {/* Recent announcements preview */}
              {announcements.length > 0 && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium text-gray-900">Recent Announcements</h3>
                    <button 
                      className="text-sm text-indigo-600 hover:text-indigo-800"
                      onClick={() => setActiveTab('announcements')}
                    >
                      View all
                    </button>
                  </div>
                  {announcements.slice(0, 3).map(announcement => (
                    <div 
                      key={announcement.id}
                      className="py-3 border-t border-gray-100 hover:bg-gray-50 cursor-pointer px-2 rounded-lg"
                      onClick={() => handleAnnouncementClick(announcement)}
                    >
                      <div className="flex items-start">
                        <div className={`w-2 h-2 mt-1.5 rounded-full flex-shrink-0 ${
                          announcement.sentiment === 'Positive' ? 'bg-emerald-500' :
                          announcement.sentiment === 'Negative' ? 'bg-rose-500' : 'bg-amber-400'
                        }`}></div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900">{announcement.category}</div>
                          <div className="text-sm text-gray-500 mt-1">{announcement.summary.substring(0, 100)}...</div>
                          <div className="text-xs text-gray-400 mt-1">{announcement.date}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          
          {/* Financials Tab */}
          {activeTab === 'financials' && (
            <div className="space-y-6">
              {stockInfo ? (
                <>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Key Financial Indicators</h2>
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Price Metrics</h3>
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-100">
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Current Price</td>
                              <td className="py-2 text-sm font-medium text-right">₹{stockInfo.ltp.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">52-Week High</td>
                              <td className="py-2 text-sm font-medium text-right">₹{stockInfo.yearHigh?.toFixed(2) || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">52-Week Low</td>
                              <td className="py-2 text-sm font-medium text-right">₹{stockInfo.yearLow?.toFixed(2) || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Market Cap</td>
                              <td className="py-2 text-sm font-medium text-right">₹{formatNumber(stockInfo.marketCap || 0)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Financial Ratios</h3>
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-100">
                            <tr>
                              <td className="py-2 text-sm text-gray-500">P/E Ratio</td>
                              <td className="py-2 text-sm font-medium text-right">{(stockInfo.pe || 0).toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">EPS</td>
                              <td className="py-2 text-sm font-medium text-right">₹{(stockInfo.eps || 0).toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Book Value</td>
                              <td className="py-2 text-sm font-medium text-right">₹{(stockInfo.bookValue || 0).toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">P/B Ratio</td>
                              <td className="py-2 text-sm font-medium text-right">{(stockInfo.ltp / (stockInfo.bookValue || 1)).toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-2">Trading Information</h3>
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-100">
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Volume</td>
                              <td className="py-2 text-sm font-medium text-right">{stockInfo.volume.toLocaleString()}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Previous Close</td>
                              <td className="py-2 text-sm font-medium text-right">₹{stockInfo.close.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Open</td>
                              <td className="py-2 text-sm font-medium text-right">₹{stockInfo.open.toFixed(2)}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Day's Range</td>
                              <td className="py-2 text-sm font-medium text-right">₹{stockInfo.low.toFixed(2)} - ₹{stockInfo.high.toFixed(2)}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-6 pb-0">
                      <h2 className="text-xl font-semibold text-gray-900 mb-2">Historical Performance</h2>
                      <p className="text-sm text-gray-500 mb-6">Stock price movement over time</p>
                    </div>
                    <StockPriceChart symbol={company.symbol} />
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <FileText size={24} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Financial data unavailable</h3>
                  <p className="text-gray-500 mb-4">We couldn't retrieve the financial information for this company.</p>
                </div>
              )}
            </div>
          )}
          
          {/* Announcements Tab */}
          {activeTab === 'announcements' && (
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h2 className="text-xl font-semibold text-gray-900 mb-6">Company Announcements</h2>
                
                <AnnouncementList
                  announcements={announcements}
                  savedFilings={savedFilings}
                  showSavedOnly={showSavedFilings}
                  isLoading={isLoading}
                  error={error}
                  onSaveToggle={toggleSavedFiling}
                  onAnnouncementClick={handleAnnouncementClick}
                  onCompanyClick={() => {}}
                  onClearFilters={() => {}}
                />
              </div>
            </div>
          )}
          
          {/* About Tab */}
          {activeTab === 'about' && (
            <div className="space-y-6">
              {companyProfile ? (
                <>
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-xl font-semibold text-gray-900 mb-4">Company Overview</h2>
                    <p className="text-gray-600 leading-relaxed mb-6">
                      {companyProfile.description}
                    </p>
                    
                    <div className="grid grid-cols-2 gap-6 mt-6">
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                          <Briefcase size={16} className="mr-2" />
                          Company Information
                        </h3>
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-100">
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Founded</td>
                              <td className="py-2 text-sm font-medium text-right">{companyProfile.founded || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Industry</td>
                              <td className="py-2 text-sm font-medium text-right">{companyProfile.industry || company.industry || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Sector</td>
                              <td className="py-2 text-sm font-medium text-right">{companyProfile.sector || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Employees</td>
                              <td className="py-2 text-sm font-medium text-right">{companyProfile.employees?.toLocaleString() || 'N/A'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                      
                      <div>
                        <h3 className="text-sm font-medium text-gray-500 mb-3 flex items-center">
                          <Users size={16} className="mr-2" />
                          Leadership & Contact
                        </h3>
                        <table className="w-full">
                          <tbody className="divide-y divide-gray-100">
                            <tr>
                              <td className="py-2 text-sm text-gray-500">CEO</td>
                              <td className="py-2 text-sm font-medium text-right">{companyProfile.ceo || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Headquarters</td>
                              <td className="py-2 text-sm font-medium text-right">{companyProfile.headquarters || 'N/A'}</td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">Website</td>
                              <td className="py-2 text-sm font-medium text-right">
                                {companyProfile.website ? (
                                  <a 
                                    href={companyProfile.website} 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    className="text-indigo-600 hover:text-indigo-800"
                                  >
                                    {companyProfile.website.replace(/(^\w+:|^)\/\//, '')}
                                  </a>
                                ) : (
                                  'N/A'
                                )}
                              </td>
                            </tr>
                            <tr>
                              <td className="py-2 text-sm text-gray-500">ISIN</td>
                              <td className="py-2 text-sm font-medium text-right">{company.isin || 'N/A'}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <div className="flex items-center mb-4">
                      <Tag size={18} className="text-gray-500 mr-2" />
                      <h3 className="text-lg font-medium text-gray-900">Related Companies</h3>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4">
                      {/* This would be populated with actual data in a real implementation */}
                      <div className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer">
                        <div className="font-medium">{companyProfile.industry} Sector</div>
                        <div className="text-sm text-gray-500 mt-1">View related companies in the same sector</div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-12 text-center">
                  <div className="w-16 h-16 mx-auto rounded-full bg-gray-100 flex items-center justify-center mb-4">
                    <Info size={24} className="text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Company information unavailable</h3>
                  <p className="text-gray-500 mb-4">We couldn't retrieve detailed information about this company.</p>
                </div>
              )}
            </div>
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
          onViewAllAnnouncements={() => {}}
        />
      )}
      
      {/* Create Watchlist Modal */}
      {showCreateWatchlistModal && (
        <CreateWatchlistModal
          onClose={() => setShowCreateWatchlistModal(false)}
          onCreateWatchlist={handleCreateWatchlist}
        />
      )}
    </MainLayout>
  );
};

export default CompanyPage;
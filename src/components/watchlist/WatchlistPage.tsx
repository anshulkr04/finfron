import React, { useState, useEffect, useRef } from 'react';
import { Upload, Search, Plus, Star, PlusCircle, AlertTriangle, Settings, MoreHorizontal, ChevronRight, XCircle, Tag, List, User } from 'lucide-react';
import MainLayout from '../layout/MainLayout';
import CompanySearch from './CompanySearch';
import EnhancedWatchlistTable from './EnhancedWatchlistTable';
import WatchlistAnnouncements from './WatchlistAnnouncements';
import BulkUpload from './BulkUpload';
import { Company } from '../../api';
import { useWatchlist } from '../../context/WatchlistContext';
import CreateWatchlistModal from './CreateWatchlistModal';
import RenameWatchlistModal from './RenameWatchlistModal';
import ConfirmDeleteModal from './confirmDeleteModal';
import WatchlistSettings from './WatchlistSettings';

interface WatchlistPageProps {
  onViewAnnouncements: (company: Company) => void;
  onNavigate: (page: 'home' | 'watchlist' | 'company', params?: any) => void;
  watchlistParams?: { watchlistId?: string };
}

const WatchlistPage: React.FC<WatchlistPageProps> = ({ 
  onViewAnnouncements, 
  onNavigate,
  watchlistParams = {}
}) => {
  const { 
    watchlists, 
    activeWatchlistId, 
    setActiveWatchlistId, 
    createWatchlist, 
    renameWatchlist,
    deleteWatchlist,
    getWatchlistById,
    bulkAddToWatchlist
  } = useWatchlist();
  
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showWatchlistMenu, setShowWatchlistMenu] = useState(false);
  const [viewMode, setViewMode] = useState<'companies' | 'announcements'>('announcements');
  
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Handle watchlist selection from params
  useEffect(() => {
    if (watchlistParams.watchlistId) {
      setActiveWatchlistId(watchlistParams.watchlistId);
    }
  }, [watchlistParams.watchlistId, setActiveWatchlistId]);
  
  // Handle click outside to close menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setShowWatchlistMenu(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Get the active watchlist
  const activeWatchlist = activeWatchlistId ? getWatchlistById(activeWatchlistId) : null;
  
  // Handle watchlist creation
  const handleCreateWatchlist = (name: string, type: 'company' | 'category' | 'mixed', categories?: string[]) => {
    createWatchlist(name, type, categories);
    setShowCreateModal(false);
  };
  
  // Handle watchlist rename
  const handleRenameWatchlist = (newName: string) => {
    if (activeWatchlistId) {
      renameWatchlist(activeWatchlistId, newName);
      setShowRenameModal(false);
    }
  };
  
  // Handle watchlist deletion
  const handleDeleteWatchlist = () => {
    if (activeWatchlistId) {
      deleteWatchlist(activeWatchlistId);
      setShowDeleteModal(false);
    }
  };
  
  // Handle company selection for adding to watchlist
  const handleCompanySelected = (company: Company) => {
    if (activeWatchlistId) {
      bulkAddToWatchlist([company], activeWatchlistId);
    }
  };
  
  // Get appropriate icon based on watchlist type
  const getWatchlistIcon = (type: string, name: string) => {
    if (name === "Real-Time Alerts") {
      return <AlertTriangle size={18} className="text-amber-500" />;
    }
    
    if (type === 'company') {
      return <Star size={18} className="text-indigo-500" />;
    } else if (type === 'category') {
      return <Tag size={18} className="text-indigo-500" />;
    } else {
      return (
        <div className="flex">
          <Star size={16} className="text-indigo-500" />
          <Tag size={16} className="text-indigo-500 ml-0.5" />
        </div>
      );
    }
  };
  
  // Header right content
  const headerRight = (
    <div className="flex items-center space-x-4">
      <div className="w-64">
        <CompanySearch 
          onCompanySelected={handleCompanySelected}
          watchlistId={activeWatchlistId || undefined}
        />
      </div>
      
      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
        <button
          className={`p-2 ${viewMode === 'announcements' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setViewMode('announcements')}
          title="Announcements View"
        >
          <List size={18} />
        </button>
        <button
          className={`p-2 ${viewMode === 'companies' ? 'bg-indigo-50 text-indigo-600' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
          onClick={() => setViewMode('companies')}
          title="Companies View"
        >
          <User size={18} />
        </button>
      </div>
      
      <button
        className="flex items-center space-x-2 px-4 py-2 rounded-xl text-sm font-medium bg-black text-white hover:bg-gray-900 transition-colors shadow-sm"
        onClick={() => setShowBulkUpload(true)}
      >
        <Upload size={16} />
        <span>Bulk Upload</span>
      </button>
    </div>
  );
  
  return (
    <MainLayout 
      activePage="watchlist"
      selectedCompany={null}
      setSelectedCompany={() => {}}
      headerRight={headerRight}
      onNavigate={onNavigate}
    >
      {/* Main content */}
      <div className="px-6 py-6 bg-gray-50 min-h-screen">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                <h3 className="font-medium text-gray-900">Your Watchlists</h3>
                <button 
                  className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
                  onClick={() => setShowCreateModal(true)}
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="p-2">
                <button
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center space-x-2 ${
                    !activeWatchlistId 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-700 hover:bg-gray-50'
                  }`}
                  onClick={() => setActiveWatchlistId(null)}
                >
                  <Star size={18} className="text-indigo-500" />
                  <span className="truncate">All Watchlists</span>
                </button>
                
                {watchlists.map(watchlist => (
                  <button
                    key={watchlist.id}
                    className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center space-x-2 ${
                      watchlist.id === activeWatchlistId 
                        ? 'bg-indigo-50 text-indigo-700' 
                        : 'text-gray-700 hover:bg-gray-50'
                    }`}
                    onClick={() => setActiveWatchlistId(watchlist.id)}
                  >
                    {getWatchlistIcon(watchlist.type, watchlist.name)}
                    <span className="truncate">{watchlist.name}</span>
                    <span className="ml-auto text-xs text-gray-500">
                      {watchlist.type === 'category' 
                        ? (watchlist.categories?.length || 0)
                        : watchlist.companies.length}
                    </span>
                  </button>
                ))}
                
                <button 
                  className="w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center space-x-2 text-gray-700 hover:bg-gray-50 mt-1"
                  onClick={() => setShowCreateModal(true)}
                >
                  <PlusCircle size={18} className="text-gray-400" />
                  <span>New Watchlist</span>
                </button>
              </div>
            </div>
          </div>
          
          {/* Main watchlist content */}
          <div className="flex-1">
            {activeWatchlist || !activeWatchlistId ? (
              <>
                <div className="flex justify-between items-start mb-6">
                  <div>
                    <div className="flex items-center mb-1">
                      {activeWatchlist ? (
                        getWatchlistIcon(activeWatchlist.type, activeWatchlist.name)
                      ) : (
                        <Star size={20} className="text-indigo-500 mr-2" />
                      )}
                      
                      <h2 className="text-xl font-semibold text-gray-900 ml-2">
                        {activeWatchlist ? activeWatchlist.name : "All Watchlists"}
                      </h2>
                      
                      {activeWatchlist && (
                        <span className="ml-3 px-3 py-0.5 text-xs font-medium rounded-full bg-indigo-50 text-indigo-700">
                          {activeWatchlist.type === 'category' 
                            ? `${activeWatchlist.categories?.length || 0} categories` 
                            : `${activeWatchlist.companies.length} companies`}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-1">
                      {activeWatchlist 
                        ? activeWatchlist.type === 'company'
                          ? "Track announcements and filings from companies you're interested in"
                          : activeWatchlist.type === 'category'
                            ? "Track specific types of corporate announcements"
                            : "Track both companies and announcement categories"
                        : "View announcements from all your watchlists"
                      }
                    </p>
                  </div>
                  
                  {activeWatchlist && !activeWatchlist.isDefault && (
                    <div className="relative" ref={menuRef}>
                      <button
                        className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-white hover:shadow-sm transition-all border border-transparent hover:border-gray-100"
                        onClick={() => setShowWatchlistMenu(!showWatchlistMenu)}
                        aria-label="Watchlist options"
                      >
                        <MoreHorizontal size={18} />
                      </button>
                      
                      {showWatchlistMenu && (
                        <div className="absolute right-0 mt-2 w-56 bg-white rounded-xl shadow-lg border border-gray-100 z-50 overflow-hidden">
                          <div className="py-1">
                            <button
                              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                setShowWatchlistMenu(false);
                                setShowSettingsModal(true);
                              }}
                            >
                              <Settings size={16} className="mr-2 text-gray-500" />
                              <span>Watchlist Settings</span>
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
                              onClick={() => {
                                setShowWatchlistMenu(false);
                                setShowRenameModal(true);
                              }}
                            >
                              <Settings size={16} className="mr-2 text-gray-500" />
                              <span>Rename Watchlist</span>
                            </button>
                            <button
                              className="flex items-center w-full px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50"
                              onClick={() => {
                                setShowWatchlistMenu(false);
                                setShowDeleteModal(true);
                              }}
                            >
                              <XCircle size={16} className="mr-2" />
                              <span>Delete Watchlist</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                {viewMode === 'announcements' ? (
                  // Show announcements from the watchlist
                  activeWatchlistId ? (
                    <WatchlistAnnouncements 
                      watchlistId={activeWatchlistId}
                      onViewAnnouncements={onViewAnnouncements}
                    />
                  ) : (
                    // Show announcements from all watchlists
                    <div className="grid grid-cols-1 gap-6">
                      {watchlists.map(watchlist => (
                        <div key={watchlist.id} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center">
                              {getWatchlistIcon(watchlist.type, watchlist.name)}
                              <h3 className="text-lg font-medium text-gray-900 ml-2">{watchlist.name}</h3>
                            </div>
                            <button
                              className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center"
                              onClick={() => setActiveWatchlistId(watchlist.id)}
                            >
                              View <ChevronRight size={16} />
                            </button>
                          </div>
                          
                          <WatchlistAnnouncements 
                            watchlistId={watchlist.id}
                            onViewAnnouncements={onViewAnnouncements}
                          />
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  // Show companies in the watchlist
                  activeWatchlistId && (
                    <EnhancedWatchlistTable 
                      watchlistId={activeWatchlistId}
                      onViewAnnouncements={onViewAnnouncements}
                    />
                  )
                )}
              </>
            ) : (
              <div className="text-center py-12 bg-white rounded-xl shadow-sm border border-gray-100">
                <Star size={40} className="mx-auto text-gray-300 mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Watchlist Selected</h3>
                <p className="text-gray-600 max-w-md mx-auto mb-6">
                  Select a watchlist from the sidebar or create a new one to get started.
                </p>
                <button
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-black rounded-lg hover:bg-gray-900"
                  onClick={() => setShowCreateModal(true)}
                >
                  <PlusCircle size={16} className="mr-2" />
                  Create New Watchlist
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Bulk Upload Modal */}
      {showBulkUpload && (
        <BulkUpload 
          onClose={() => setShowBulkUpload(false)} 
          watchlistId={activeWatchlistId || undefined}
        />
      )}
      
      {/* Create Watchlist Modal */}
      {showCreateModal && (
        <CreateWatchlistModal
          onClose={() => setShowCreateModal(false)}
          onCreateWatchlist={handleCreateWatchlist}
        />
      )}
      
      {/* Rename Watchlist Modal */}
      {showRenameModal && activeWatchlistId && (
        <RenameWatchlistModal
          watchlistId={activeWatchlistId}
          currentName={activeWatchlist?.name || ""}
          onClose={() => setShowRenameModal(false)}
          onRenameWatchlist={handleRenameWatchlist}
        />
      )}
      
      {/* Delete Watchlist Confirmation Modal */}
      {showDeleteModal && activeWatchlistId && (
        <ConfirmDeleteModal
          watchlistName={activeWatchlist?.name || ""}
          onClose={() => setShowDeleteModal(false)}
          onConfirmDelete={handleDeleteWatchlist}
        />
      )}
      
      {/* Watchlist Settings Modal */}
      {showSettingsModal && activeWatchlistId && activeWatchlist && (
        <WatchlistSettings 
          watchlist={activeWatchlist}
          onClose={() => setShowSettingsModal(false)}
        />
      )}
    </MainLayout>
  );
};

export default WatchlistPage;
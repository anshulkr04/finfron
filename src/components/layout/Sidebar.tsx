import React, { useState } from 'react';
import { Home, Star, Bell, Search, Menu, ChevronRight, Plus, Edit, AlertTriangle, MoreHorizontal, Trash2 } from 'lucide-react';
import { useWatchlist } from '../../context/WatchlistContext';
import CreateWatchlistModal from '../watchlist/CreateWatchlistModal.tsx';
import RenameWatchlistModal from '../watchlist/RenameWatchlistModal';
import ConfirmDeleteModal from '../watchlist/confirmDeleteModal';

interface SidebarProps {
  activePage: 'home' | 'watchlist' | 'company';
  selectedCompany: string | null;
  sidebarExpanded: boolean;
  setSidebarExpanded: (expanded: boolean) => void;
  onNavigate: (page: 'home' | 'watchlist' | 'company', params?: {watchlistId?: string}) => void;
  onFilterClick?: () => void; // Keep the prop but make it optional
}

const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  selectedCompany,
  sidebarExpanded,
  setSidebarExpanded,
  onNavigate
}) => {
  const { 
    watchlists, 
    activeWatchlistId, 
    setActiveWatchlistId, 
    createWatchlist,
    renameWatchlist,
    deleteWatchlist
  } = useWatchlist();
  
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedWatchlistId, setSelectedWatchlistId] = useState<string | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState<{id: string, x: number, y: number} | null>(null);

  // Handle create watchlist
  const handleCreateWatchlist = (name: string) => {
    createWatchlist(name);
    setShowCreateModal(false);
  };

  // Handle rename watchlist
  const handleRenameWatchlist = (newName: string) => {
    if (selectedWatchlistId) {
      renameWatchlist(selectedWatchlistId, newName);
      setShowRenameModal(false);
      setSelectedWatchlistId(null);
    }
  };

  // Handle delete watchlist
  const handleDeleteWatchlist = () => {
    if (selectedWatchlistId) {
      deleteWatchlist(selectedWatchlistId);
      setShowDeleteModal(false);
      setSelectedWatchlistId(null);
    }
  };

  // Handle watchlist click
  const handleWatchlistClick = (watchlistId: string) => {
    setActiveWatchlistId(watchlistId);
    onNavigate('watchlist', { watchlistId });
  };

  // Show context menu for a watchlist
  const handleWatchlistContextMenu = (e: React.MouseEvent, watchlistId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuPos({
      id: watchlistId,
      x: e.clientX,
      y: e.clientY
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenuPos(null);
  };

  // Handle edit watchlist from context menu
  const handleEditWatchlist = (watchlistId: string) => {
    setSelectedWatchlistId(watchlistId);
    setShowRenameModal(true);
    closeContextMenu();
  };

  // Handle delete watchlist from context menu
  const handleConfirmDelete = (watchlistId: string) => {
    setSelectedWatchlistId(watchlistId);
    setShowDeleteModal(true);
    closeContextMenu();
  };

  // Close context menu when clicking outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      closeContextMenu();
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => {
      document.removeEventListener('click', handleClickOutside);
    };
  }, []);

  return (
    <>
      <div 
        className={`fixed left-0 top-0 h-full bg-white shadow-md z-10 transition-all duration-300 ease-in-out ${
          sidebarExpanded ? 'w-64' : 'w-16'
        }`}
      >
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-100">
          <button 
            onClick={() => onNavigate('home')}
            className="w-10 h-10 bg-black rounded-2xl flex items-center justify-center text-white font-medium"
          >
            F
          </button>
          {sidebarExpanded && (
            <button 
              onClick={() => setSidebarExpanded(false)}
              className="p-2 rounded-xl text-gray-400 hover:text-gray-900"
            >
              <ChevronRight size={18} />
            </button>
          )}
        </div>
        
        <div className="flex flex-col h-full pt-6 pb-4 overflow-y-auto">
          <div className={`flex flex-col ${sidebarExpanded ? 'px-3' : 'items-center'} space-y-2 mb-6`}>
            <button 
              className={`flex items-center ${sidebarExpanded ? 'justify-start px-4' : 'justify-center'} py-2 rounded-xl w-full ${
                activePage === 'home' && !selectedCompany ? 'text-black' : 'text-gray-400'
              } hover:bg-gray-100 transition-colors`}
              onClick={() => onNavigate('home')}
            >
              <Home size={20} />
              {sidebarExpanded && <span className="ml-3 font-medium">Home</span>}
            </button>
            
            <button 
              className={`flex items-center ${sidebarExpanded ? 'justify-start px-4' : 'justify-center'} py-2 rounded-xl w-full ${
                activePage === 'company' ? 'text-black' : 'text-gray-400'
              } hover:bg-gray-100 transition-colors`}
              onClick={() => onNavigate('company')}
            >
              <Search size={20} />
              {sidebarExpanded && <span className="ml-3 font-medium">Search</span>}
            </button>
            
            {/* Filter button removed as requested */}
            
            <button 
              className={`flex items-center ${sidebarExpanded ? 'justify-start px-4' : 'justify-center'} py-2 rounded-xl w-full text-gray-400 hover:bg-gray-100 transition-colors`}
            >
              <Bell size={20} />
              {sidebarExpanded && <span className="ml-3 font-medium">Alerts</span>}
            </button>
          </div>
          
          {/* Watchlists Section */}
          {sidebarExpanded && (
            <div className="px-4 py-2">
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Watchlists</h4>
                <button
                  className="p-1 text-gray-400 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                  onClick={() => setShowCreateModal(true)}
                  title="Create New Watchlist"
                >
                  <Plus size={16} />
                </button>
              </div>
              
              <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                {watchlists.map(watchlist => (
                  <div 
                    key={watchlist.id} 
                    className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer ${
                      activeWatchlistId === watchlist.id ? 'bg-gray-100 text-black' : 'text-gray-600 hover:bg-gray-50'
                    } group transition-colors`}
                    onClick={() => handleWatchlistClick(watchlist.id)}
                    onContextMenu={(e) => !watchlist.isDefault && handleWatchlistContextMenu(e, watchlist.id)}
                  >
                    <div className="flex items-center truncate">
                      {watchlist.name === "Real-Time Alerts" ? (
                        <AlertTriangle size={16} className="text-amber-500 mr-2 flex-shrink-0" />
                      ) : (
                        <Star size={16} className={`mr-2 flex-shrink-0 ${activeWatchlistId === watchlist.id ? 'text-gray-900' : 'text-gray-400'}`} />
                      )}
                      <span className="truncate">{watchlist.name}</span>
                      <span className="ml-2 text-xs text-gray-400">({watchlist.companies.length})</span>
                    </div>
                    
                    {!watchlist.isDefault && (
                      <button
                        className="p-1 text-gray-400 hover:text-gray-900 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleWatchlistContextMenu(e, watchlist.id);
                        }}
                      >
                        <MoreHorizontal size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              
              {/* Create New Watchlist Button */}
              <button
                className="flex items-center justify-center w-full px-3 py-2 mt-2 text-sm font-medium text-gray-700 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus size={16} className="mr-2" />
                <span>Create New Watchlist</span>
              </button>
            </div>
          )}
          
          {/* Collapsed View - Show watchlist icon only */}
          {!sidebarExpanded && (
            <div className="flex flex-col items-center pt-2 space-y-4">
              <button 
                className={`p-2 rounded-xl ${
                  activePage === 'watchlist' ? 'text-black bg-gray-100' : 'text-gray-400 hover:bg-gray-100'
                } transition-colors`}
                onClick={() => onNavigate('watchlist')}
                title="Watchlists"
              >
                <Star size={20} />
              </button>
              
              <button 
                className="p-2 rounded-xl text-gray-400 hover:bg-gray-100 transition-colors"
                onClick={() => setShowCreateModal(true)}
                title="Create New Watchlist"
              >
                <Plus size={20} />
              </button>
            </div>
          )}
          
          {!sidebarExpanded && (
            <button 
              onClick={() => setSidebarExpanded(true)}
              className="absolute top-20 -right-3 p-1.5 bg-white rounded-full shadow-md text-gray-400 hover:text-gray-900"
            >
              <Menu size={14} />
            </button>
          )}
        </div>
      </div>
      
      {/* Context Menu */}
      {contextMenuPos && (
        <div 
          className="fixed z-50 bg-white rounded-lg shadow-float border border-gray-100 py-1 w-48"
          style={{ 
            top: contextMenuPos.y, 
            left: contextMenuPos.x,
            // Ensure menu doesn't go off screen
            transform: `translate(${
              contextMenuPos.x + 200 > window.innerWidth ? '-100%' : '0'
            }, ${
              contextMenuPos.y + 120 > window.innerHeight ? '-50%' : '0'
            })`
          }}
        >
          <button
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            onClick={() => handleEditWatchlist(contextMenuPos.id)}
          >
            <Edit size={16} className="mr-2" />
            <span>Rename</span>
          </button>
          <button
            className="flex items-center w-full px-4 py-2 text-sm text-rose-600 hover:bg-gray-50"
            onClick={() => handleConfirmDelete(contextMenuPos.id)}
          >
            <Trash2 size={16} className="mr-2" />
            <span>Delete</span>
          </button>
        </div>
      )}
      
      {/* Create Watchlist Modal */}
      {showCreateModal && (
        <CreateWatchlistModal
          onClose={() => setShowCreateModal(false)}
          onCreateWatchlist={handleCreateWatchlist}
        />
      )}
      
      {/* Rename Watchlist Modal */}
      {showRenameModal && selectedWatchlistId && (
        <RenameWatchlistModal
          watchlistId={selectedWatchlistId}
          currentName={watchlists.find(w => w.id === selectedWatchlistId)?.name || ""}
          onClose={() => {
            setShowRenameModal(false);
            setSelectedWatchlistId(null);
          }}
          onRenameWatchlist={handleRenameWatchlist}
        />
      )}
      
      {/* Delete Watchlist Confirmation Modal */}
      {showDeleteModal && selectedWatchlistId && (
        <ConfirmDeleteModal
          watchlistName={watchlists.find(w => w.id === selectedWatchlistId)?.name || ""}
          onClose={() => {
            setShowDeleteModal(false);
            setSelectedWatchlistId(null);
          }}
          onConfirmDelete={handleDeleteWatchlist}
        />
      )}
    </>
  );
};

export default Sidebar;
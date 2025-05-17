import React, { useState, useEffect } from 'react';
import { X, Tag, Settings, Save, Star, Users } from 'lucide-react';
import { Watchlist, useWatchlist } from '../../context/WatchlistContext';
import CategorySelector from './CategorySelector';

interface WatchlistSettingsProps {
  watchlist: Watchlist;
  onClose: () => void;
}

const WatchlistSettings: React.FC<WatchlistSettingsProps> = ({ watchlist, onClose }) => {
  const { updateWatchlistCategories } = useWatchlist();
  const [watchlistType, setWatchlistType] = useState<'company' | 'category' | 'mixed'>(watchlist.type);
  const [selectedCategories, setSelectedCategories] = useState<string[]>(watchlist.categories || []);
  const [isModified, setIsModified] = useState(false);
  
  // Set initial state based on watchlist
  useEffect(() => {
    setWatchlistType(watchlist.type);
    setSelectedCategories(watchlist.categories || []);
  }, [watchlist]);
  
  // Check if changes have been made
  useEffect(() => {
    const categoriesChanged = JSON.stringify(selectedCategories) !== JSON.stringify(watchlist.categories || []);
    const typeChanged = watchlistType !== watchlist.type;
    
    setIsModified(categoriesChanged || typeChanged);
  }, [selectedCategories, watchlistType, watchlist]);
  
  // Handle save
  const handleSave = () => {
    updateWatchlistCategories(watchlist.id, selectedCategories);
    onClose();
  };
  
  // Get watchlist content summary
  const getWatchlistSummary = () => {
    if (watchlist.type === 'company') {
      return `${watchlist.companies.length} companies`;
    } else if (watchlist.type === 'category') {
      return `${watchlist.categories?.length || 0} categories`;
    } else {
      return `${watchlist.companies.length} companies, ${watchlist.categories?.length || 0} categories`;
    }
  };
  
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full animate-fade-in mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 border-b border-gray-100">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Settings className="text-indigo-500 mr-2.5" size={22} />
              <h3 className="text-xl font-semibold text-gray-900">Watchlist Settings</h3>
            </div>
            <button 
              className="p-2 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-900 transition-colors"
              onClick={onClose}
            >
              <X size={20} />
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6">
          <div className="mb-6">
            <h4 className="text-base font-medium text-gray-900 mb-2">{watchlist.name}</h4>
            <div className="text-sm text-gray-600 mb-4">
              Current configuration: {getWatchlistSummary()}
            </div>
            
            <div className="bg-gray-50 border border-gray-100 rounded-xl p-4">
              <h5 className="font-medium text-sm text-gray-900 mb-3">Watchlist Type</h5>
              <div className="grid grid-cols-3 gap-3 mb-4">
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 border rounded-xl ${
                    watchlistType === 'company'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  onClick={() => setWatchlistType('company')}
                >
                  <Users size={20} className={`mb-2 ${watchlistType === 'company' ? 'text-indigo-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">Companies</span>
                </button>
                
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 border rounded-xl ${
                    watchlistType === 'category'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  onClick={() => setWatchlistType('category')}
                >
                  <Tag size={20} className={`mb-2 ${watchlistType === 'category' ? 'text-indigo-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">Categories</span>
                </button>
                
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 border rounded-xl ${
                    watchlistType === 'mixed'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  onClick={() => setWatchlistType('mixed')}
                >
                  <div className="flex mb-2">
                    <Users size={18} className={`${watchlistType === 'mixed' ? 'text-indigo-500' : 'text-gray-400'}`} />
                    <Tag size={18} className={`ml-1 ${watchlistType === 'mixed' ? 'text-indigo-500' : 'text-gray-400'}`} />
                  </div>
                  <span className="text-sm font-medium">Both</span>
                </button>
              </div>
              
              {/* Companies section */}
              {(watchlistType === 'company' || watchlistType === 'mixed') && watchlist.companies.length > 0 && (
                <div className="mb-4">
                  <h5 className="font-medium text-sm text-gray-900 mb-2">Companies ({watchlist.companies.length})</h5>
                  <div className="bg-white border border-gray-100 rounded-lg p-3 max-h-36 overflow-y-auto">
                    <div className="flex flex-wrap gap-2">
                      {watchlist.companies.map(company => (
                        <div 
                          key={company.id}
                          className="inline-flex items-center bg-indigo-50 text-indigo-700 px-2.5 py-1 rounded-full text-sm font-medium"
                        >
                          {company.symbol}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              
              {/* Categories section */}
              {(watchlistType === 'category' || watchlistType === 'mixed') && (
                <div>
                  <h5 className="font-medium text-sm text-gray-900 mb-2">Categories ({selectedCategories.length})</h5>
                  <CategorySelector 
                    selectedCategories={selectedCategories}
                    onChange={setSelectedCategories}
                  />
                </div>
              )}
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              type="button"
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              onClick={onClose}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors flex items-center ${
                isModified
                  ? 'text-white bg-indigo-600 hover:bg-indigo-700'
                  : 'text-gray-400 bg-gray-100 cursor-not-allowed'
              }`}
              onClick={handleSave}
              disabled={!isModified}
            >
              <Save size={16} className="mr-1.5" />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WatchlistSettings;
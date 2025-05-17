import React, { useState, useRef, useEffect } from 'react';
import { X, Star, AlertTriangle, Info, Tag, User } from 'lucide-react';
import ImprovedCategorySelector from './CategorySelector';

interface CreateWatchlistModalProps {
  onClose: () => void;
  onCreateWatchlist: (name: string, type: 'company' | 'category' | 'mixed', categories?: string[]) => void;
}

const FixedEnhancedCreateWatchlistModal: React.FC<CreateWatchlistModalProps> = ({ onClose, onCreateWatchlist }) => {
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [charCount, setCharCount] = useState(0);
  const [watchlistType, setWatchlistType] = useState<'company' | 'category' | 'mixed'>('company');
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus input when modal opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
    
    // Prevent body scrolling when modal is open
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'auto';
    };
  }, []);
  
  // Update character count
  useEffect(() => {
    setCharCount(name.length);
  }, [name]);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate name
    if (!name.trim()) {
      setError('Please enter a watchlist name');
      return;
    }
    
    // Check name length
    if (name.length > 30) {
      setError('Watchlist name must be 30 characters or less');
      return;
    }
    
    // For category type, ensure categories are selected
    if ((watchlistType === 'category' || watchlistType === 'mixed') && selectedCategories.length === 0) {
      setError('Please select at least one category');
      return;
    }
    
    onCreateWatchlist(name.trim(), watchlistType, selectedCategories);
  };
  
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-lg w-full animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Star className="text-indigo-500 mr-2.5" size={22} />
              <h3 className="text-xl font-semibold text-gray-900">Create New Watchlist</h3>
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
          <form onSubmit={handleSubmit}>
            <div className="mb-5">
              <div className="flex justify-between items-center mb-1.5">
                <label htmlFor="watchlist-name" className="block text-sm font-medium text-gray-700">
                  Watchlist Name
                </label>
                <span className={`text-xs ${charCount > 25 ? 'text-amber-500' : 'text-gray-400'}`}>
                  {charCount}/30
                </span>
              </div>
              
              <input
                ref={inputRef}
                id="watchlist-name"
                type="text"
                placeholder="Enter watchlist name"
                className={`w-full px-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                  error 
                    ? 'border-rose-300 focus:ring-rose-100' 
                    : 'border-gray-200 focus:ring-indigo-100 focus:border-indigo-300'
                }`}
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError('');
                }}
                maxLength={30}
              />
              
              {error ? (
                <div className="mt-1.5 flex items-start">
                  <AlertTriangle size={14} className="text-rose-500 mt-0.5 mr-1.5 flex-shrink-0" />
                  <p className="text-sm text-rose-500">{error}</p>
                </div>
              ) : (
                <div className="mt-1.5 flex items-start text-gray-500">
                  <Info size={14} className="mt-0.5 mr-1.5 flex-shrink-0" />
                  <p className="text-xs">
                    Create a new watchlist to track companies or categories you're interested in.
                  </p>
                </div>
              )}
            </div>
            
            {/* Watchlist Type Selection */}
            <div className="mb-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Watchlist Type
              </label>
              
              <div className="grid grid-cols-3 gap-3">
                <button
                  type="button"
                  className={`flex flex-col items-center justify-center p-3 border rounded-xl ${
                    watchlistType === 'company'
                      ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}
                  onClick={() => setWatchlistType('company')}
                >
                  <User size={20} className={`mb-2 ${watchlistType === 'company' ? 'text-indigo-500' : 'text-gray-400'}`} />
                  <span className="text-sm font-medium">Companies</span>
                  <span className="text-xs mt-1 text-center">Track specific companies</span>
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
                  <span className="text-xs mt-1 text-center">Track by filing type</span>
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
                    <User size={18} className={`${watchlistType === 'mixed' ? 'text-indigo-500' : 'text-gray-400'}`} />
                    <Tag size={18} className={`ml-1 ${watchlistType === 'mixed' ? 'text-indigo-500' : 'text-gray-400'}`} />
                  </div>
                  <span className="text-sm font-medium">Both</span>
                  <span className="text-xs mt-1 text-center">Companies & categories</span>
                </button>
              </div>
            </div>
            
            {/* Category Selection (if applicable) */}
            {(watchlistType === 'category' || watchlistType === 'mixed') && (
              <div className="mb-5">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Categories
                </label>
                
                <ImprovedCategorySelector 
                  selectedCategories={selectedCategories}
                  onChange={setSelectedCategories}
                />
                
                {selectedCategories.length > 0 && (
                  <div className="mt-2 text-xs text-gray-500">
                    {selectedCategories.length} {selectedCategories.length === 1 ? 'category' : 'categories'} selected
                  </div>
                )}
              </div>
            )}
            
            {/* Divider */}
            <div className="h-px bg-gray-100 my-5"></div>
            
            <div className="flex justify-end space-x-3">
              <button
                type="button"
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-5 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
                disabled={!name.trim() || ((watchlistType === 'category' || watchlistType === 'mixed') && selectedCategories.length === 0)}
              >
                Create Watchlist
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default FixedEnhancedCreateWatchlistModal;
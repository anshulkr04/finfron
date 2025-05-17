import React, { useState, useRef, useEffect } from 'react';
import { X, Star, AlertTriangle, Settings } from 'lucide-react';

interface RenameWatchlistModalProps {
  watchlistId: string;
  currentName: string;
  onClose: () => void;
  onRenameWatchlist: (newName: string) => void;
}

const RenameWatchlistModal: React.FC<RenameWatchlistModalProps> = ({ 
  watchlistId, 
  currentName, 
  onClose, 
  onRenameWatchlist 
}) => {
  const [name, setName] = useState(currentName);
  const [error, setError] = useState('');
  const [charCount, setCharCount] = useState(currentName.length);
  const inputRef = useRef<HTMLInputElement>(null);
  
  // Focus input when modal opens
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
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
    
    // Check if name is unchanged
    if (name.trim() === currentName) {
      onClose();
      return;
    }
    
    onRenameWatchlist(name.trim());
  };
  
  const hasChanges = name.trim() !== currentName;
  
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-md w-full animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-6 pb-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <Settings className="text-indigo-500 mr-2.5" size={20} />
              <h3 className="text-xl font-semibold text-gray-900">Rename Watchlist</h3>
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
              
              <div className="relative">
                <input
                  ref={inputRef}
                  id="watchlist-name"
                  type="text"
                  placeholder="Enter watchlist name"
                  className={`w-full pl-9 pr-4 py-2.5 border rounded-xl focus:outline-none focus:ring-2 transition-all ${
                    error 
                      ? 'border-rose-300 focus:ring-rose-100' 
                      : hasChanges
                        ? 'border-indigo-200 focus:ring-indigo-100 focus:border-indigo-300'
                        : 'border-gray-200 focus:ring-indigo-100 focus:border-indigo-300'
                  }`}
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (error) setError('');
                  }}
                  maxLength={30}
                />
                <Star size={16} className="absolute left-3 top-3 text-gray-400" />
              </div>
              
              {error && (
                <div className="mt-1.5 flex items-start">
                  <AlertTriangle size={14} className="text-rose-500 mt-0.5 mr-1.5 flex-shrink-0" />
                  <p className="text-sm text-rose-500">{error}</p>
                </div>
              )}
            </div>
            
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
                className={`px-5 py-2 text-sm font-medium rounded-lg transition-colors shadow-sm ${
                  hasChanges 
                    ? 'text-white bg-indigo-600 hover:bg-indigo-700' 
                    : 'text-gray-400 bg-gray-100 cursor-not-allowed'
                }`}
                disabled={!hasChanges || !name.trim()}
              >
                Rename
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default RenameWatchlistModal;
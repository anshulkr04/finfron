import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDeleteModalProps {
  watchlistName: string;
  onClose: () => void;
  onConfirmDelete: () => void;
}

const ConfirmDeleteModal: React.FC<ConfirmDeleteModalProps> = ({ 
  watchlistName, 
  onClose, 
  onConfirmDelete 
}) => {
  const handleConfirm = () => {
    onConfirmDelete();
  };
  
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center backdrop-blur-sm">
      <div 
        className="bg-white rounded-2xl shadow-xl max-w-md w-full animate-fade-in mx-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-0">
          <div className="flex justify-between items-center">
            <div className="flex items-center">
              <div className="mr-3 bg-rose-100 rounded-full p-1.5">
                <AlertTriangle className="text-rose-600" size={22} />
              </div>
              <h3 className="text-xl font-semibold text-gray-900">Delete Watchlist</h3>
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
          <div className="mb-5">
            <p className="text-gray-700 mb-3">
              Are you sure you want to delete <span className="font-semibold">"{watchlistName}"</span> watchlist? This action cannot be undone.
            </p>
            
            <div className="bg-amber-50 border border-amber-100 rounded-xl p-4 text-sm text-amber-800">
              <div className="flex items-start">
                <AlertTriangle className="flex-shrink-0 mr-2.5 mt-0.5" size={16} />
                <div>
                  <p className="font-medium mb-1">Warning</p>
                  <p>All companies in this watchlist will be removed from it. This does not delete the companies themselves.</p>
                </div>
              </div>
            </div>
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
              type="button"
              className="px-5 py-2 text-sm font-medium text-white bg-rose-600 rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
              onClick={handleConfirm}
            >
              Delete Watchlist
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDeleteModal;
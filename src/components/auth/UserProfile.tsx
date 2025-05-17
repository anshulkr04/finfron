import React, { useState } from 'react';
import { User, LogOut, Mail, CheckCircle, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface UserProfileProps {
  onClose: () => void;
}

const UserProfile: React.FC<UserProfileProps> = ({ onClose }) => {
  const { user, signOut } = useAuth();
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignOut = async () => {
    setIsLoggingOut(true);
    setError(null);
    
    try {
      await signOut();
      onClose();
    } catch (err) {
      console.error('Error signing out:', err);
      setError('Failed to sign out. Please try again.');
      setIsLoggingOut(false);
    }
  };

  if (!user) {
    return null;
  }

  // Extract first letter of email for avatar
  const firstLetter = user.email?.charAt(0).toUpperCase() || 'U';

  return (
    <div className="w-full max-w-sm bg-white rounded-2xl shadow-float border border-gray-100 py-6 px-4">
      <div className="flex items-center mb-6">
        <div className="w-14 h-14 rounded-full bg-indigo-100 flex items-center justify-center text-xl font-semibold text-indigo-700 mr-4">
          {firstLetter}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center">
            <p className="text-sm font-medium text-gray-900 truncate">
              {user.email}
            </p>
            {user.email_confirmed_at ? (
              <div className="ml-2 flex items-center text-xs text-emerald-600">
                <CheckCircle size={12} className="mr-1" />
                <span>Verified</span>
              </div>
            ) : (
              <div className="ml-2 flex items-center text-xs text-amber-600">
                <AlertCircle size={12} className="mr-1" />
                <span>Unverified</span>
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            User ID: {user.id.substring(0, 8)}...
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm flex items-center">
          <AlertCircle className="h-4 w-4 mr-2" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-2">
        <button
          className="w-full flex items-center justify-center bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={onClose}
        >
          <User size={16} className="mr-2" />
          <span>Profile Settings</span>
        </button>
        
        <button
          className="w-full flex items-center justify-center bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
          onClick={onClose}
        >
          <Mail size={16} className="mr-2" />
          <span>Email Preferences</span>
        </button>
        
        <button
          className="w-full flex items-center justify-center bg-white border border-gray-200 rounded-lg px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50 hover:border-rose-100 transition-colors"
          onClick={handleSignOut}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? (
            <div className="flex items-center">
              <div className="w-4 h-4 border-2 border-rose-600 border-t-transparent rounded-full animate-spin mr-2"></div>
              <span>Signing out...</span>
            </div>
          ) : (
            <>
              <LogOut size={16} className="mr-2" />
              <span>Sign Out</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default UserProfile;
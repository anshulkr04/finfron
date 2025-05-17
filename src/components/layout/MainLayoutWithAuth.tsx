import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import FilterModal from '../common/FilterModal';
import UserProfile from '../auth/UserProfile';
import { useAuth } from '../../context/AuthContext';

interface MainLayoutProps {
  children: React.ReactNode;
  headerRight?: React.ReactNode; // Optional right side header content
  activePage: 'home' | 'watchlist' | 'company';
  selectedCompany: string | null;
  setSelectedCompany: (company: string | null) => void;
  onNavigate: (page: 'home' | 'watchlist' | 'company') => void;
}

const MainLayout: React.FC<MainLayoutProps> = ({
  children,
  headerRight,
  activePage,
  selectedCompany,
  setSelectedCompany,
  onNavigate
}) => {
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [showUserProfile, setShowUserProfile] = useState(false);
  
  const userProfileRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Get the title based on the active page
  const getPageTitle = () => {
    switch (activePage) {
      case 'watchlist':
        return 'Watchlist';
      case 'company':
        return selectedCompany || 'Company';
      default:
        return ''; // No title for home as it's shown in the header content
    }
  };
  
  // Handle click outside to close user profile
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userProfileRef.current && !userProfileRef.current.contains(e.target as Node)) {
        setShowUserProfile(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  // Extract first letter of email for avatar
  const firstLetter = user?.email?.charAt(0).toUpperCase() || 'U';
  
  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      <Sidebar 
        activePage={activePage}
        selectedCompany={selectedCompany}
        sidebarExpanded={sidebarExpanded}
        setSidebarExpanded={setSidebarExpanded}
        onNavigate={onNavigate}
        onFilterClick={() => setShowFilterModal(true)}
      />
      
      <div 
        className={`flex flex-col transition-all duration-300 ${sidebarExpanded ? 'ml-64' : 'ml-16'} flex-1`}
      >
        <div className="bg-white shadow-sm px-6 py-4 flex items-center justify-between sticky top-0 z-20">
          <div className="text-xl font-semibold text-gray-900">
            {getPageTitle()}
          </div>
          
          {/* Header right content wrapper to include user profile */}
          <div className="flex items-center">
            {/* Header right content passed as prop */}
            {headerRight}
            
            {/* User profile button */}
            <div className="relative ml-4" ref={userProfileRef}>
              <button
                className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-lg font-semibold text-indigo-700 hover:bg-indigo-200 transition-colors"
                onClick={() => setShowUserProfile(!showUserProfile)}
              >
                {firstLetter}
              </button>
              
              {/* User profile dropdown */}
              {showUserProfile && (
                <div className="absolute right-0 mt-2 z-30 transform -translate-x-1/2 translate-x-4">
                  <UserProfile onClose={() => setShowUserProfile(false)} />
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Main content */}
        {children}
      </div>
      
      {/* Filter Modal */}
      {showFilterModal && (
        <FilterModal 
          onClose={() => setShowFilterModal(false)}
        />
      )}
    </div>
  );
};

export default MainLayout;
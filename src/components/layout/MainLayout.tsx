import React, { useState } from 'react';
import Sidebar from './Sidebar';
import FilterModal from '../common/FilterModal';

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
          
          {/* Header right content passed as prop */}
          {headerRight}
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
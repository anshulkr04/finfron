// App.tsx with improved error handling and announcement processing

// Import statements
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import WatchlistPage from './components/watchlist/WatchlistPage';
import CompanyPage from './components/company/CompanyPage';
import AuthRouter from './components/auth/AuthRouter';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { WatchlistProvider } from './context/WatchlistContext';
import { FilterProvider } from './context/FilterContext';
import { AuthProvider } from './context/AuthContext';
import { Company, ProcessedAnnouncement, enhanceAnnouncementData } from './api';
import { SocketProvider } from './context/SocketContext';
import { useAuth } from './context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';
import NotificationIndicator from './components/common/NotificationIndicator';

// Inner component with enhanced socket handling
const AppWithSocket = () => {
  const [activePage, setActivePage] = useState<'dashboard' | 'watchlist' | 'company'>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [watchlistParams, setWatchlistParams] = useState<{ watchlistId?: string }>({});
  const [newAnnouncements, setNewAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const { user } = useAuth();
  const isAuthenticated = !!user;
  const processedAnnouncementIds = useRef<Set<string>>(new Set());

  // Navigation handlers
  // Handle scrolling to new announcements
  const handleViewNewAnnouncements = () => {
    // Reset to first page
    setCurrentPage(1);
    
    // Scroll to top where new announcements are displayed
    window.scrollTo({
      top: 0,
      behavior: 'smooth'
    });
  };
  

  const handleNavigate = (page: 'home' | 'watchlist' | 'company', params?: { watchlistId?: string }) => {
    if (page === 'home') {
      setActivePage('dashboard');
      setSelectedCompany(null);
    } else if (page === 'watchlist') {
      setActivePage('watchlist');
      if (params?.watchlistId) {
        setWatchlistParams({ watchlistId: params.watchlistId });
      }
    } else if (page === 'company' && selectedCompany) {
      setActivePage('company');
    }
  };

  const handleCompanyClick = (company: Company) => {
    setSelectedCompany(company);
    setActivePage('company');
  };

  // Enhanced new announcement handler with better error handling
  const handleNewAnnouncement = useCallback((rawAnnouncement: any) => {
    try {
      console.log('New announcement received:', rawAnnouncement);
      
      // Basic validation
      if (!rawAnnouncement) {
        console.warn('Received empty announcement data');
        return;
      }
      
      // Create a unique ID for deduplication
      const announcementId = rawAnnouncement.corp_id || 
                             rawAnnouncement.id || 
                             `new-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Check if we've already processed this announcement
      if (processedAnnouncementIds.current.has(announcementId)) {
        console.log(`Announcement ${announcementId} already processed, skipping`);
        return;
      }
      
      // Mark as processed
      processedAnnouncementIds.current.add(announcementId);
      
      // Format basic announcement data
      const baseAnnouncement: ProcessedAnnouncement = {
        id: announcementId,
        company: rawAnnouncement.companyname || rawAnnouncement.company || "Unknown Company",
        ticker: rawAnnouncement.symbol || rawAnnouncement.Symbol || "",
        category: rawAnnouncement.category || rawAnnouncement.Category || "Other",
        date: new Date().toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        }),
        summary: rawAnnouncement.ai_summary || rawAnnouncement.summary || "",
        detailedContent: rawAnnouncement.ai_summary || rawAnnouncement.summary || "",
        isin: rawAnnouncement.isin || rawAnnouncement.ISIN || "",
        sentiment: "Neutral",
        receivedAt: Date.now()
      };
      
      // Enhance the announcement data
      let processedAnnouncement: ProcessedAnnouncement;
      try {
        processedAnnouncement = enhanceAnnouncementData([baseAnnouncement])[0];
      } catch (enhanceError) {
        console.error('Error enhancing announcement data:', enhanceError);
        // Fallback to base announcement if enhancement fails
        processedAnnouncement = baseAnnouncement;
      }
      
      // Update state with the new announcement
      setNewAnnouncements(prev => {
        // Check for duplicates again (by ID, which should be unique)
        if (prev.some(a => a.id === processedAnnouncement.id)) {
          return prev; // No change if duplicate
        }
        return [processedAnnouncement, ...prev];
      });
      
      // Show toast notification with company info and summary
      toast.success(
        <div>
          <div className="font-medium">{processedAnnouncement.company}</div>
          <div className="text-sm">
            {processedAnnouncement.summary?.substring(0, 80)}
            {processedAnnouncement.summary?.length > 80 ? '...' : ''}
          </div>
        </div>, 
        {
          duration: 5000,
          position: 'top-right',
          className: 'announcement-toast',
          icon: '🔔',
        }
      );
    } catch (error) {
      console.error('Error processing new announcement:', error);
    }
  }, []);
  
  // Cleanup old "new" announcements after a while
  useEffect(() => {
    if (newAnnouncements.length > 0) {
      const timer = setTimeout(() => {
        // Move announcements from "new" to regular after 5 minutes
        const now = Date.now();
        const fiveMinutesAgo = now - 5 * 60 * 1000;
        
        setNewAnnouncements(prev => 
          prev.filter(announcement => {
            // Keep only announcements that arrived in the last 5 minutes
            const announcementTime = announcement.receivedAt || now;
            return announcementTime > fiveMinutesAgo;
          })
        );
      }, 60000); // Check every minute
      
      return () => clearTimeout(timer);
    }
  }, [newAnnouncements]);

  // We only want to use socket connections when user is authenticated
  if (!isAuthenticated) {
    return (
      <Router>
        <Routes>
          {/* Auth Routes */}
          <Route path="/auth/*" element={<AuthRouter />} />
          <Route path="*" element={<Navigate to="/auth/login" replace />} />
        </Routes>
      </Router>
    );
  }

  // Return fully configured app
  return (
    <SocketProvider onNewAnnouncement={handleNewAnnouncement}>
      <Router>
        <FilterProvider>
          <WatchlistProvider>
            <Routes>
              {/* Auth Routes */}
              <Route path="/auth/*" element={<AuthRouter />} />
              
              {/* Protected App Routes */}
              <Route path="/" element={
                <ProtectedRoute>
                  {activePage === 'dashboard' ? (
                    <Dashboard 
                      onNavigate={handleNavigate} 
                      onCompanySelect={handleCompanyClick}
                      newAnnouncements={newAnnouncements}
                    />
                  ) : activePage === 'watchlist' ? (
                    <WatchlistPage 
                      onViewAnnouncements={handleViewAnnouncements} 
                      onNavigate={handleNavigate} 
                      watchlistParams={watchlistParams}
                      newAnnouncements={newAnnouncements}
                    />
                  ) : (
                    selectedCompany && (
                      <CompanyPage 
                        company={selectedCompany} 
                        onNavigate={handleNavigate}
                        onBack={() => setActivePage('dashboard')} 
                        newAnnouncements={newAnnouncements.filter(
                          a => a.company === selectedCompany.name || 
                              a.isin === selectedCompany.isin ||
                              a.ticker === selectedCompany.symbol
                        )} // Filter announcements relevant to this company
                      />
                    )
                  )}
                </ProtectedRoute>
              } />
              
              {/* Fallback route */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
            <NotificationIndicator 
              onViewNewAnnouncements={handleViewNewAnnouncements}
            />
          </WatchlistProvider>
        </FilterProvider>
      </Router>
      {/* Toast container for notifications */}
      <Toaster />
    </SocketProvider>
  );
};

// Main component
function App() {
  return (
    <AuthProvider>
      <AppWithSocket />
    </AuthProvider>
  );
}

export default App;
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './components/Dashboard';
import WatchlistPage from './components/watchlist/WatchlistPage';
import CompanyPage from './components/company/CompanyPage';
import AuthRouter from './components/auth/AuthRouter';
import ProtectedRoute from './components/auth/ProtectedRoute';
import { WatchlistProvider } from './context/WatchlistContext';
import { FilterProvider } from './context/FilterContext';
import { AuthProvider } from './context/AuthContext';
import { Company, ProcessedAnnouncement } from './api';
import { SocketProvider } from './context/SocketContext';
import { useAuth } from './context/AuthContext';
import { toast, Toaster } from 'react-hot-toast';

// Inner component to access auth context
const AppWithSocket = () => {
  const [activePage, setActivePage] = useState<'dashboard' | 'watchlist' | 'company'>('dashboard');
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [watchlistParams, setWatchlistParams] = useState<{ watchlistId?: string }>({});
  const [newAnnouncements, setNewAnnouncements] = useState<ProcessedAnnouncement[]>([]);
  const { user } = useAuth();
  const isAuthenticated = !!user;

  const handleViewAnnouncements = (company: Company) => {
    setSelectedCompany(company);
    setActivePage('company');
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

  // Handle new announcements from socket
  const handleNewAnnouncement = (announcement: ProcessedAnnouncement) => {
    console.log('New announcement received:', announcement);
    
    // Add to our state while preventing duplicates
    setNewAnnouncements(prev => {
      const isDuplicate = prev.some(a => a.id === announcement.id);
      if (isDuplicate) return prev;
      return [announcement, ...prev];
    });
    
    // Show a toast notification with company info and summary
    toast.success(
      <div>
        <p className="font-medium">{announcement.company}</p>
        <p className="text-sm">{announcement.summary?.substring(0, 80)}...</p>
      </div>, 
      {
        duration: 5000,
        position: 'top-right',
        className: 'announcement-toast',
      }
    );
  };

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